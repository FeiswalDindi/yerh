import { useCatalog } from '../../app/useCatalog';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
export function FaqPage() {
  const { faqs } = useCatalog();
  usePageTitle('Frequently asked questions');
  return (
    <>
      <PageIntro
        eyebrow="FAQ"
        title="A little clarity for your next step."
        description="Answers to the questions from the original YERH hub, with guidance for the local demo."
      />
      <section className="container section">
        <div className="faq-list faq-full">
          {faqs.map((faq) => (
            <details key={faq.question}>
              <summary>
                {faq.question}
                <span>+</span>
              </summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
