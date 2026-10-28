import { render } from '@testing-library/react'
import { RichText } from './RichText.tsx'

describe('説明文の表示', () => {
  it('飾りを表示する', () => {
    const { container, getByText } = render(
      <RichText
        blocks={[
          { type: 'paragraph', align: 'center', spans: [{ text: '太字', bold: true, color: 'pink', size: 'large' }] },
          { type: 'bullet', spans: [{ text: 'その1' }] },
          { type: 'bullet', spans: [{ text: 'その2', marker: true }] },
        ]}
      />,
    )
    expect(getByText('太字').tagName).toBe('STRONG')
    expect(container.querySelector('p')).toHaveClass('rt-center')
    expect(container.querySelectorAll('ul > li')).toHaveLength(2)
    expect(getByText('その2')).toHaveClass('rt-marker')
  })

  it('HTML やおかしな色が書かれていても、ただの文字として出す', () => {
    const { container } = render(
      <RichText
        blocks={[{ type: 'paragraph', spans: [{ text: '<img src=x onerror=alert(1)>', color: 'red;background:url(x)' }] }]}
      />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('<img src=x onerror=alert(1)>')
    expect(container.querySelector('span')!.getAttribute('style') ?? '').not.toContain('url')
  })
})
