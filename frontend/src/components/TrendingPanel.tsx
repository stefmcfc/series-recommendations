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
