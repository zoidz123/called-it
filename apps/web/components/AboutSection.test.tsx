import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { AboutSection } from './AboutSection'

test('renders the evidence-based About section', () => {
  const markup = renderToStaticMarkup(<AboutSection />)

  expect(markup).toContain('aria-labelledby="about-title"')
  expect(markup).toContain('Public calls, checked against the price.')
  expect(markup).toContain('Read the public record')
  expect(markup).toContain('Separate clear stances')
  expect(markup).toContain('Show what followed')
  expect(markup).toContain('not a complete trading record or investment advice')
})
