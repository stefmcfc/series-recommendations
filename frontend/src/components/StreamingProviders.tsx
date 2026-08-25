import type { StreamingProvider } from '../types/series'
import styles from './StreamingProviders.module.css'

interface StreamingProvidersProps {
  readonly providers: StreamingProvider[]
}

export function StreamingProviders({ providers }: StreamingProvidersProps) {
  if (providers.length === 0) {
    return (
      <span className={styles.streamingProvidersEmpty}>
        Not currently streaming in the UK
      </span>
    )
  }

  return (
    <ul className={styles.streamingProviders}>
      {providers.map((provider) => (
        <li key={provider.name} className={styles.streamingProvider}>
          {provider.logoUrl !== null && (
            <img
              src={provider.logoUrl}
              alt={provider.name}
              className={styles.streamingProviderLogo}
            />
          )}
          <span>{provider.name}</span>
        </li>
      ))}
    </ul>
  )
}
