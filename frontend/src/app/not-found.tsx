import { ButtonLink, PageIntro } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <PageIntro eyebrow="404" title="This page isn't here.">
        The link may be old, or the page was moved.
      </PageIntro>
      <ButtonLink href="/" className="mt-8">Back to ProofLoop</ButtonLink>
    </div>
  );
}
