export default {
  name: 'caseStudy',
  title: 'Casestudie',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Tittel',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'client',
      title: 'Kunde',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'slug',
      title: 'Slugg',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: Rule => Rule.required()
    },
    {
      name: 'coverImage',
      title: 'Forsidebilde',
      type: 'image',
      options: {
        hotspot: true, // Muliggjør beskjæring og fokuspunkt i Sanity-panelet
      },
    },
    {
      name: 'body',
      title: 'Brødtekst',
      type: 'array',
      description: 'Rik tekstblokk som inneholder hovedartikkelens innhold.',
      of: [
        {
          type: 'block',
          styles: [
            { title: 'Normal', value: 'normal' },
            { title: 'H2', value: 'h2' },
            { title: 'H3', value: 'h3' },
            { title: 'Sitat', value: 'blockquote' }
          ],
          lists: [{ title: 'Kulepunkt', value: 'bullet' }]
        }
      ]
    }
  ]
};
