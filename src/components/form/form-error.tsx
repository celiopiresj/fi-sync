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
    <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      <p className="font-medium">{title}</p>
      <p>{description}</p>
    </div>
  );
}
