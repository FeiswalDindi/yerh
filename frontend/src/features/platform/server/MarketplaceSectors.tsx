import {
  marketplaceSectors,
  saveMarketplaceSector,
  type MarketplaceSector,
} from '../../../services/laravel-marketplace-sectors';
import { WorkspaceTable } from '../workspace/WorkspaceControls';
import { useWorkspaceRecords, RecordsFeedback, WorkspaceAction } from './WorkspaceActions';

export function SectorSelect({ value }: { value?: string }) {
  const { records, error } = useWorkspaceRecords(marketplaceSectors);
  return (
    <>
      <select name="sector" required key={records ? 'ready' : 'loading'} defaultValue={value ?? ''}>
        <option value="" disabled>
          {records ? 'Select a sector' : 'Loading sectors…'}
        </option>
        {records?.map(({ id, name }) => (
          <option key={id} value={name}>
            {name}
          </option>
        ))}
      </select>
      {error && <span role="alert">{error}</span>}
    </>
  );
}

function CategoryEditor({
  category,
  onSaved,
}: {
  category?: MarketplaceSector;
  onSaved: () => void;
}) {
  return (
    <WorkspaceAction
      action={category ? 'Edit' : 'Add category'}
      title={category ? 'Change picture for ' + category.name : 'Add marketplace category'}
      create={!category}
      save={async (form) => {
        await saveMarketplaceSector(form, category?.id);
        onSaved();
      }}
    >
      {!category && (
        <label>
          Category name
          <input name="name" required maxLength={100} />
        </label>
      )}
      <label>
        Card picture (JPEG, PNG or WebP, up to 2 MB)
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          required={!!category}
        />
      </label>
    </WorkspaceAction>
  );
}

export function MarketplaceSectorAdmin() {
  const { records, error, reload } = useWorkspaceRecords(marketplaceSectors);
  return (
    <>
      <RecordsFeedback loading={!records} error={error} />
      {records && (
        <WorkspaceTable
          label="marketplace categories"
          columns={['Category', 'Card picture', 'Action']}
          actions={<CategoryEditor onSaved={reload} />}
          rows={records.map((category) => ({
            id: String(category.id),
            search: category.name,
            cells: [
              category.name,
              category.image ? (
                <img
                  className="sector-thumbnail"
                  src={category.image}
                  alt=""
                  width={72}
                  height={48}
                />
              ) : (
                'Default icon'
              ),
              <CategoryEditor category={category} onSaved={reload} />,
            ],
          }))}
        />
      )}
    </>
  );
}
