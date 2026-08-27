// Server-side error alert (e.g. "invalid credentials" back from a Server
// Action) — distinct from per-field validation errors, which
// `field.TextField` already renders inline. Renders nothing when there's
// no error, so call sites can do `<FormError title={...} description={error} />`
// unconditionally.
type FormErrorProps = {
  title: string;
  description: string | null;
};

export function FormError({ title, description }: FormErrorProps) {
  if (!description) return null;

  return (
    <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <p className="font-medium">{title}</p>
      <p>{description}</p>
    </div>
  );
}
