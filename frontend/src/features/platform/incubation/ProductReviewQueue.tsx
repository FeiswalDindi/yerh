import { WorkspaceTable } from '../workspace/WorkspaceControls';
import type { PlatformState } from '../../../domain/platform';
import { field, TrainingForm, type Save } from './TrainingForms';

export function ProductReviewQueue({
  p,
  save,
  mentorId,
}: {
  p: PlatformState;
  save: Save;
  mentorId?: string;
}) {
  const entries = p.training.productReviews.filter(
    (review) =>
      review.status === 'pending' &&
      p.incubations.some(
        (path) =>
          path.id === review.incubationId &&
          (!mentorId || path.mentorId === mentorId) &&
          p.ventures.some((venture) => venture.id === path.ventureId && !venture.groupId),
      ),
  );
  return (
    <WorkspaceTable
      label="product evidence"
      columns={['Product', 'Venture', 'Action']}
      empty="No product evidence is awaiting review."
      rows={entries.map((review) => {
        const product = p.products.find((product) => product.id === review.productId);
        const productName = product?.name ?? 'Product';
        const venture = p.ventures.find((venture) => venture.id === product?.ventureId);
        return {
          id: review.productId,
          search: [productName, venture?.name].join(' '),
          cells: [
            productName,
            venture?.name,
            <TrainingForm
              save={save}
              dialog={{ action: 'Review evidence', title: productName }}
              label="Save product evidence decision"
              build={(data) => ({
                type: 'product-evidence-review',
                productId: review.productId,
                decision: field(data, 'decision') === 'approved' ? 'approved' : 'rejected',
                feedback: field(data, 'feedback'),
              })}
            >
              <p className="workspace-detail-copy">{review.evidence}</p>
              <label>
                Decision{' '}
                <select name="decision">
                  <option value="approved">Approve product evidence</option>
                  <option value="rejected">Return for revisions</option>
                </select>
              </label>
              <label>
                Reviewer feedback{' '}
                <textarea name="feedback" required minLength={5} maxLength={3000} />
              </label>
            </TrainingForm>,
          ],
        };
      })}
    />
  );
}
