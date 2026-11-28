import { useState } from 'react';
import { useCatalog } from '../../app/useCatalog';
import { VideoDialog } from '../media/VideoDialog';
import { StoryPortrait } from './StoryPortrait';
export function StoriesSection() {
  const { items, homepage } = useCatalog();
  const [storyFilter, setStoryFilter] = useState<'All' | 'Entrepreneur' | 'Startups'>('All');
  const [activeVideo, setActiveVideo] = useState<{ url: string; title: string } | null>(null);
  const allFeaturedStories = homepage.featuredStories.flatMap((id) =>
    items.filter((item) => item.id === id),
  );
  const filteredStories = allFeaturedStories.filter(
    (story) => storyFilter === 'All' || story.storyGroups?.includes(storyFilter),
  );
  return (
    <>
      {/* 2. My Story Section */}
      <section className="home-section my-story-section" aria-labelledby="my-story-title">
        <h2 id="my-story-title" className="home-section-title">
          {homepage.myStoryTitle?.trim() || 'My Story'}
        </h2>
        {homepage.myStorySubtitle?.trim() && (
          <p className="home-section-subtitle" style={{ textAlign: 'center', marginTop: '-8px' }}>
            {homepage.myStorySubtitle}
          </p>
        )}

        {/* Filter Tabs */}
        <div className="story-filter-tabs" role="group" aria-label="Filter stories">
          {(['All', 'Entrepreneur', 'Startups'] as const).map((tab) => (
            <button
              key={tab}
              type="button"

              aria-pressed={storyFilter === tab}
              className={`story-tab-btn ${storyFilter === tab ? 'active' : ''}`}
              onClick={() => setStoryFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Stories Grid with Soft Show Hover Effect matching screenshot */}
        <div className="my-story-grid">
          {filteredStories.length > 0 ? (
            filteredStories.map((story) => (
              <StoryPortrait
                key={`${storyFilter}:${story.id}`}
                story={story}
                onPlay={(url) => setActiveVideo({ url, title: story.title })}
              />
            ))
          ) : (
            <p className="source-note" style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
              No stories match this filter yet.
            </p>
          )}
        </div>
      </section>

      {activeVideo && (
        <VideoDialog
          url={activeVideo.url}
          title={activeVideo.title}
          onClose={() => setActiveVideo(null)}
        />
      )}
    </>
  );
}
