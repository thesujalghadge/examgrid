import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PlatformPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Operations Center</h1>
        <p className="text-sm text-gray-600">
          Multi-tenant academic infrastructure control for institutes, content pipelines,
          and intelligence systems.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {["Institutes", "Pipelines", "Question Assets", "Health Signals"].map((item) => (
          <Card key={item}>
            <CardHeader>
              <CardTitle className="text-base">{item}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              Platform-level operational visibility.
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
