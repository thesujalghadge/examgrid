import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PlaceholderPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-gray-600">{description}</CardContent>
    </Card>
  );
}
