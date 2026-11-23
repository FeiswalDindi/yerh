import { useState } from 'react';
import { Link } from 'react-router-dom';
import { contentPath, type ContentBlock } from '../../../domain/content';
import {
  editorialRepository,
  type EditorialRecord,
} from '../../../services/laravel-editorial-repository';
import { WorkspaceTable } from '../workspace/WorkspaceControls';
import {
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';

const editorialKinds = { article: 'Article', story: 'Story', publication: 'Report' };

function ContentBlocks({ initial }: { initial: ContentBlock[] }) {
  const [count, setCount] = useState(initial.length || 1);
  return (
    <fieldset>
      <legend>Content</legend>
      {Array.from({ length: count }, (_, index) => (
        <div className="workspace-form-grid" key={index}>
          <label>
            Block type
            <select name="block_type" defaultValue={initial[index]?.type ?? 'paragraph'}>
              <option value="paragraph">Paragraph</option>
              <option value="heading">Heading</option>
              <option value="list-item">List item</option>
            </select>
          </label>
          <label>
            Text
            <textarea
              name="block_text"
              defaultValue={initial[index]?.text}
              maxLength={12000}
              required
            />
          </label>
        </div>
      ))}
      <div className="workspace-row-actions">
        {count < 100 && (
          <button
            className="button button-outline workspace-action"
            type="button"
            onClick={() => setCount(count + 1)}
          >
            Add block
          </button>
        )}
        {count > 1 && (
          <button
            className="button button-outline workspace-action"
            type="button"
            onClick={() => setCount(count - 1)}
          >
            Remove last
          </button>
        )}
      </div>
    </fieldset>
  );
}

function EditorialEditor({ record, reload }: { record?: EditorialRecord; reload: () => void }) {
  return (
    <WorkspaceAction
      action={record ? 'Edit' : 'Add content'}
      title={record?.content.title}
      create={!record}
      save={async (form) => {
        const types = form.getAll('block_type');
        await editorialRepository.save(
          {
            kind: record?.content.kind ?? fieldValue(form, 'kind'),
            title: fieldValue(form, 'title'),
            category: fieldValue(form, 'category'),
            excerpt: fieldValue(form, 'excerpt'),
            status: fieldValue(form, 'status'),
            featured: form.has('featured'),
            blocks: form.getAll('block_text').map((text, index) => ({ text, type: types[index] })),
          },
          record?.id,
        );
        reload();
        window.dispatchEvent(new Event('yerh:editorial-updated'));
      }}
    >
      {!record && (
        <label>
          Content type
          <select name="kind">
            {Object.entries(editorialKinds).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Title
        <input name="title" defaultValue={record?.content.title} maxLength={160} required />
      </label>
      <label>
        Category
        <input name="category" defaultValue={record?.content.category} maxLength={80} required />
      </label>
      <label>
        Summary
        <textarea name="excerpt" defaultValue={record?.content.excerpt} maxLength={500} required />
      </label>
      <label>
        Publication
        <select name="status" defaultValue={record?.status ?? 'draft'}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      {(!record || record.content.kind === 'story') && (
        <label className="checkbox-label">
          <input name="featured" type="checkbox" defaultChecked={record?.featured} />
          Feature story on the homepage
        </label>
      )}
      <ContentBlocks initial={record?.content.blocks ?? []} />
    </WorkspaceAction>
  );
}

export function EditorialWorkspace() {
  const { records, error, reload } = useWorkspaceRecords(editorialRepository.entries);
  return (
    <>
      <RecordsFeedback error={error} loading={records === null} />
      {records && (
        <WorkspaceTable
          label="editorial content"
          columns={['Title', 'Type', 'Category', 'Publication', 'Actions']}
          actions={<EditorialEditor reload={reload} />}
          rows={records.map((entry) => ({
            id: String(entry.id),
            search: [
              entry.content.title,
              entry.content.kind,
              entry.content.category,
              entry.status,
            ].join(' '),
            cells: [
              entry.content.title,
              editorialKinds[entry.content.kind as keyof typeof editorialKinds] ??
                entry.content.kind,
              entry.content.category,
              entry.status,
              <div className="workspace-row-actions">
                <EditorialEditor record={entry} reload={reload} />
                {entry.status === 'published' && <Link to={contentPath(entry.content)}>View</Link>}
              </div>,
            ],
          }))}
        />
      )}
    </>
  );
}
