import type { ControlsState } from './RecommendationControls'
import styles from './RecommendationControls.module.css'

interface TrendingPanelProps {
  readonly state: ControlsState
  readonly updateState: (patch: Partial<ControlsState>) => void
}

// TOOLING-008-AC-04: the Trending Window radio group, extracted from
// RecommendationControls.tsx's former `state.discoverMode === 'trending'`
// tabpanel block.
export function TrendingPanel({ state, updateState }: TrendingPanelProps) {
  return (
    <div
      role="tabpanel"
      id="discover-panel-trending"
      aria-labelledby="discover-tab-trending"
      className={styles.tabPanel}
    >
      {/* FRONTEND-111-AC-02: same always-visible-hint treatment
        UseMySeriesPanel's own hint already has, giving Popular Right Now an
        equivalent one-line explanation of what it does. */}
      <p className={styles.hint}>
        Shows trending globally on TMDB right now — not personalized to your
        ratings, genres, or watch history.
      </p>

      <fieldset className={styles.modeFieldset}>
        <legend>Trending Window</legend>

        <div className={styles.modeOption}>
          <input
            id="trending-window-day"
            type="radio"
            name="trending-window"
            checked={state.trendingWindow === 'day'}
            onChange={() => updateState({ trendingWindow: 'day' })}
          />
          <label htmlFor="trending-window-day">Day</label>
        </div>

        <div className={styles.modeOption}>
          <input
            id="trending-window-week"
            type="radio"
            name="trending-window"
            checked={state.trendingWindow === 'week'}
            onChange={() => updateState({ trendingWindow: 'week' })}
          />
          <label htmlFor="trending-window-week">Week</label>
        </div>
      </fieldset>
    </div>
  )
}
