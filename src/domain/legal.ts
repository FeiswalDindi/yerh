export interface TermsDocument {
  title: string;
  effectiveDate: string;
  intro: string;
  summary: string[];
  sections: { title: string; paragraphs: string[] }[];
  contactEmail: string;
  source: string;
}
