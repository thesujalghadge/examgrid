"use server";

import { createServiceRoleClient } from "@/lib/institute/get-institute-api-key";
import { revalidatePath } from "next/cache";

const getClient = () => {
  const client = createServiceRoleClient();
  if (!client) throw new Error("Supabase is not configured");
  return client;
};

export async function getCurricula() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("curricula")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function createCurriculum(name: string, description: string) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("curricula")
    .insert([{ name, description }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/platform/curricula");
  return data;
}

export async function getCurriculum(id: string) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("curricula")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCurriculum(id: string) {
  const supabase = getClient();
  const { error } = await supabase
    .from("curricula")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/platform/curricula");
}

export async function getCurriculumVersions(curriculumId: string) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("curriculum_versions")
    .select("*")
    .eq("curriculum_id", curriculumId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function getCurriculumVersion(versionId: string) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("curriculum_versions")
    .select("*, curricula(name)")
    .eq("id", versionId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getCurriculumArtifacts(versionId: string) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("curriculum_artifacts")
    .select("*")
    .eq("version_id", versionId)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data;
}

export async function getCurriculumNodes(versionId: string) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("curriculum_nodes")
    .select("*")
    .eq("version_id", versionId)
    .order("order_index", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function createCurriculumVersion(
  curriculumId: string,
  versionName: string,
  formData: FormData
) {
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("PDF file is required");

  const supabase = getClient();

  // 1. Create the version
  const { data: version, error: versionError } = await supabase
    .from("curriculum_versions")
    .insert([{ curriculum_id: curriculumId, version_name: versionName, status: 'UPLOADED' }])
    .select()
    .single();

  if (versionError) throw new Error(versionError.message);

  // 2. Upload file to storage
  const fileExt = file.name.split('.').pop();
  const fileName = `${version.id}.${fileExt}`;
  const filePath = `${curriculumId}/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("curriculum_artifacts")
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage
    .from("curriculum_artifacts")
    .getPublicUrl(filePath);

  // 3. Create the artifact record
  const { error: artifactError } = await supabase
    .from("curriculum_artifacts")
    .insert([{ 
      version_id: version.id, 
      original_pdf_url: publicUrlData.publicUrl 
    }]);

  if (artifactError) throw new Error(artifactError.message);

  revalidatePath(`/platform/curricula/${curriculumId}`);
  return version;
}

export async function updateCurriculumVersionStatus(versionId: string, status: string) {
  const supabase = getClient();
  const { error } = await supabase
    .from("curriculum_versions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", versionId);

  if (error) throw new Error(error.message);
  revalidatePath(`/platform/curricula`);
}

export async function publishCurriculumVersion(versionId: string) {
  const supabase = getClient();
  
  // 1. Update status
  const { error } = await supabase
    .from("curriculum_versions")
    .update({ status: 'PUBLISHED', updated_at: new Date().toISOString() })
    .eq("id", versionId);

  if (error) throw new Error(error.message);

  // 2. Queue an embedding job
  const { error: jobError } = await supabase
    .from("classification_jobs")
    .insert([{
      job_type: 'EMBED_CURRICULUM',
      payload: { versionId }
    }]);

  if (jobError) {
    console.error("Failed to enqueue embedding job:", jobError);
    // Don't throw here to avoid failing the business publish transaction if job queuing fails,
    // though ideally they should be in a transaction or robust queue system.
  }

  revalidatePath(`/platform/curricula`);
}

export async function saveParsedSyllabus(versionId: string, parsedJson: any) {
  const supabase = getClient();
  
  // Save the JSON
  const { error: artifactsErr } = await supabase
    .from("curriculum_artifacts")
    .update({ parsed_json: parsedJson })
    .eq("version_id", versionId);
  if (artifactsErr) throw new Error(artifactsErr.message);

  // Clear existing nodes to avoid duplicates if re-parsed
  await supabase
    .from("curriculum_nodes")
    .delete()
    .eq("version_id", versionId);

  // Recursively insert nodes
  const subjects = parsedJson.subjects || [];
  for (let s = 0; s < subjects.length; s++) {
    const subject = subjects[s];
    const { data: subNode, error: err1 } = await supabase
      .from("curriculum_nodes")
      .insert({ version_id: versionId, node_type: "SUBJECT", name: subject.name, order_index: s })
      .select().single();
    if (err1) throw err1;

    const chapters = subject.chapters || [];
    for (let c = 0; c < chapters.length; c++) {
      const chapter = chapters[c];
      const { data: chapNode, error: err2 } = await supabase
        .from("curriculum_nodes")
        .insert({ version_id: versionId, parent_id: subNode.id, node_type: "CHAPTER", name: chapter.name, order_index: c })
        .select().single();
      if (err2) throw err2;

      const topics = chapter.topics || [];
      for (let t = 0; t < topics.length; t++) {
        const topic = topics[t];
        const { data: topNode, error: err3 } = await supabase
          .from("curriculum_nodes")
          .insert({ version_id: versionId, parent_id: chapNode.id, node_type: "TOPIC", name: topic.name, order_index: t })
          .select().single();
        if (err3) throw err3;

        const subtopics = topic.subtopics || [];
        for (let st = 0; st < subtopics.length; st++) {
          const subtopic = subtopics[st];
          const { error: err4 } = await supabase
            .from("curriculum_nodes")
            .insert({ version_id: versionId, parent_id: topNode.id, node_type: "SUBTOPIC", name: subtopic.name, order_index: st });
          if (err4) throw err4;
        }
      }
    }
  }
}
