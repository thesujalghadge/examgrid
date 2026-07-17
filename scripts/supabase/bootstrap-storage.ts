import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const REQUIRED_BUCKETS = ["cbt_assets", "solutions", "cbt-assets"];

async function bootstrapStorage() {
  console.log("Starting Storage Provisioning...");
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase credentials in environment variables.");
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error("Failed to list buckets:", listError.message);
    process.exit(1);
  }

  const existingBucketNames = buckets.map(b => b.name);

  for (const bucketName of REQUIRED_BUCKETS) {
    if (existingBucketNames.includes(bucketName)) {
      console.log(`✅ Bucket '${bucketName}' already exists.`);
    } else {
      console.log(`Creating bucket '${bucketName}'...`);
      const { data, error } = await supabase.storage.createBucket(bucketName, {
        public: false,
        allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "application/pdf", "application/json"],
      });
      
      if (error) {
        console.error(`❌ Failed to create bucket '${bucketName}':`, error.message);
      } else {
        console.log(`✅ Successfully created bucket '${bucketName}'.`);
        
        // Let's also update the bucket to be public if needed. Wait, in Supabase, the API is createBucket(id, options). 
        // We will make 'cbt_assets' and 'cbt-assets' public so images can be viewed without signed URLs.
        if (bucketName.includes("cbt_assets") || bucketName.includes("cbt-assets")) {
          const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
            public: true,
            allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "application/pdf", "application/json"],
          });
          if (updateError) {
            console.error(`❌ Failed to make bucket '${bucketName}' public:`, updateError.message);
          } else {
            console.log(`✅ Made bucket '${bucketName}' public.`);
          }
        }
      }
    }
  }

  console.log("Storage provisioning complete.");
}

bootstrapStorage().catch(err => {
  console.error("Unexpected error during storage bootstrap:", err);
  process.exit(1);
});
