import { describe, expect, it } from 'vitest'
import { parseMakerWorldModels, pickRandomModels } from './makerworld'

describe('MakerWorld recommendations', () => {
  it('extracts model cards from public listing HTML', () => {
    const html = `
      <a href="/en/models/12345" data-model-name="Desk Organizer" data-author="Maker Alice">
        <img src="/uploads/organizer.jpg" alt="Desk Organizer" />
      </a>
      <a href="https://makerworld.com/en/models/67890?from=home" aria-label="Vase by Maker Bob">
        <img src="//cdn.example.com/vase.jpg" alt="Vase" />
      </a>
      <script type="application/ld+json">
        {"name":"Robot","url":"https://makerworld.com/en/models/24680","image":"/uploads/robot.jpg","author":{"name":"Maker Carol"}}
      </script>
    `

    expect(parseMakerWorldModels(html)).toEqual([
      {
        id: '12345',
        name: 'Desk Organizer',
        author: 'Maker Alice',
        imageUrl: 'https://makerworld.com/uploads/organizer.jpg',
        url: 'https://makerworld.com/en/models/12345',
      },
      {
        id: '67890',
        name: 'Vase',
        author: 'Maker Bob',
        imageUrl: 'https://cdn.example.com/vase.jpg',
        url: 'https://makerworld.com/en/models/67890',
      },
      {
        id: '24680',
        name: 'Robot',
        author: 'Maker Carol',
        imageUrl: 'https://makerworld.com/uploads/robot.jpg',
        url: 'https://makerworld.com/en/models/24680',
      },
    ])
  })

  it('returns unique random models without exceeding the requested count', () => {
    const models = Array.from({ length: 6 }, (_, index) => ({
      id: String(index),
      name: `Model ${index}`,
      author: `Maker ${index}`,
      imageUrl: `https://example.com/${index}.jpg`,
      url: `https://makerworld.com/en/models/${index}`,
    }))

    const selected = pickRandomModels(models, 4, () => 0)
    expect(selected).toHaveLength(4)
    expect(new Set(selected.map((model) => model.id)).size).toBe(4)
  })
})
