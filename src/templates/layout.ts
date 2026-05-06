export function renderFullPage(pageData: any, client: any, generatedComponentsHtml: string): string {
  const city = pageData?.city || 'Local Area';
  const keyword = pageData?.keyword || 'Services';

  // 1. Extract Hero Headline
  let heroHeadline = `${keyword} in ${city}`;
  if (pageData?.components) {
    const hero = pageData.components.find((c: any) => c.type === 'hero' || c.component === 'hero');
    if (hero?.data?.headline) {
      heroHeadline = hero.data.headline;
    }
  }

  // 2. Extract SEO Article Description
  let description = `${client?.name || 'Our Company'} offers premium ${keyword} services in ${city}. Contact us today to learn more and get started.`;
  if (pageData?.components) {
    const seoArticle = pageData.components.find((c: any) => c.type === 'seoArticle' || c.component === 'seoArticle');
    if (seoArticle?.data) {
      if (seoArticle.data.body && seoArticle.data.body.length > 0) {
        description = seoArticle.data.body.substring(0, 150).replace(/"/g, '&quot;');
      } else if (seoArticle.data.paragraphs && seoArticle.data.paragraphs.length > 0) {
        description = seoArticle.data.paragraphs[0].substring(0, 150).replace(/"/g, '&quot;');
      }
    }
  }

  // 3. Assemble Meta Tags
  const title = `${heroHeadline} | ${city} | ${client?.name || 'Services'}`;
  const slugCity = city.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const slugKeyword = keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const canonicalUrl = `${client?.website || 'https://example.com'}/${slugCity}/${slugKeyword}`;

  // 4. Schema.org (LocalBusiness)
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": client?.niche === 'Education' || client?.niche?.toLowerCase().includes('tuition') ? 'EducationalOrganization' : 'LocalBusiness',
    "name": client?.name || 'Local Business',
    "telephone": client?.phone || '',
    "url": client?.website || '',
    "address": {
      "@type": "PostalAddress",
      "addressLocality": city
    }
  };

  // 5. Schema.org (FAQPage)
  let faqSchemaHtml = '';
  if (pageData?.components) {
    const faq = pageData.components.find((c: any) => c.type === 'faq' || c.component === 'faq');
    if (faq?.data?.items && Array.isArray(faq.data.items) && faq.data.items.length > 0) {
      const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faq.data.items.map((item: any) => ({
          "@type": "Question",
          "name": item.title || '',
          "acceptedAnswer": {
            "@type": "Answer",
            "text": item.description || ''
          }
        }))
      };
      faqSchemaHtml = `\n  <script type="application/ld+json">\n${JSON.stringify(faqSchema, null, 4)}\n  </script>`;
    }
  }

  // 6. Build the Full HTML
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonicalUrl}">
  
  <!-- CSS & Fonts -->
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
  <script src="https://unpkg.com/@phosphor-icons/web"></script>
  
  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">
${JSON.stringify(localBusinessSchema, null, 4)}
  </script>${faqSchemaHtml}
</head>
<body class="bg-gray-50 text-gray-900 antialiased font-sans selection:bg-blue-200">
  
  <main class="min-h-screen">
${generatedComponentsHtml}
  </main>

  <!-- Animation Scripts -->
  <script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      AOS.init({
        duration: 800,
        once: true,
        offset: 100,
        easing: 'ease-out-cubic'
      });
    });
  </script>
</body>
</html>`;
}
