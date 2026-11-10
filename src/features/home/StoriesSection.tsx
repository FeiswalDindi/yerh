import { useState } from 'react';
import { useCatalog } from '../../app/useCatalog';
import { VideoDialog } from '../media/VideoDialog';
import { StoryPortrait } from './StoryPortrait';
export function StoriesSection() {
  const { items, homepage } = useCatalog();
  const [storyFilter, setStoryFilter] = useState<'All' | 'Entrepreneur' | 'Startups'>('All');
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
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
          My Story
        </h2>

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
          {filteredStories.map((story) => (
            <StoryPortrait
              key={`${storyFilter}:${story.id}`}
              story={story}
              onPlay={setActiveVideo}
            />
          ))}
        </div>
      </section>

      {activeVideo && <VideoDialog url={activeVideo} onClose={() => setActiveVideo(null)} />}
    </>
  );
}
