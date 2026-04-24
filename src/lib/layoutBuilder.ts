import { Client } from '@prisma/client';

export interface PageData {
  keyword: string;
  city: string;
  metaDescription: string;
  slug: string;
}

export function generateFullPageHtml(client: Client, seoContent: string, pageData: PageData): string {
  const logoHtml = client.logoUrl
    ? `<img src="${client.logoUrl}" alt="${client.name} Logo" class="h-10 w-auto" />`
    : `<span class="text-2xl font-bold text-gray-900">${client.name}</span>`;

  const phoneHtml = client.contactPhone
    ? `<a href="tel:${client.contactPhone}" class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white hover:opacity-90 transition-opacity" style="background-color: ${client.primaryColor}">Call Now: ${client.contactPhone}</a>`
    : '';

  const footerLink = client.mainWebsiteUrl
    ? `<a href="${client.mainWebsiteUrl}" class="text-blue-600 hover:text-blue-800 transition-colors">Visit our main website</a>`
    : '';

  let whatsAppHtml = '';
  if (client.contactPhone) {
    const cleanPhone = client.contactPhone.replace(/\D/g, '');
    const message = encodeURIComponent(`Hello, I am interested in your ${pageData.keyword} services in ${pageData.city}.`);
    const waUrl = `https://wa.me/${cleanPhone}?text=${message}`;
    whatsAppHtml = `
    <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="fixed bottom-6 right-6 z-50 flex items-center justify-center w-16 h-16 bg-[#25D366] text-white rounded-full shadow-2xl hover:scale-110 hover:-translate-y-1 transition-all duration-300">
      <i class="ph ph-whatsapp-logo text-4xl"></i>
    </a>`;
  }

  return `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageData.keyword} in ${pageData.city} | ${client.name}</title>
    <meta name="description" content="${pageData.metaDescription}">
    <link rel="canonical" href="${client.mainWebsiteUrl}/locations/${pageData.slug}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "provider": {
        "@type": "LocalBusiness",
        "name": "${client.name}",
        "url": "${client.mainWebsiteUrl}",
        "logo": "${client.logoUrl || ''}",
        "telephone": "${client.contactPhone || ''}"
      },
      "serviceType": "${pageData.keyword}",
      "areaServed": {
        "@type": "City",
        "name": "${pageData.city}"
      }
    }
    </script>
    <script src="https://unpkg.com/@phosphor-icons/web"></script>
    <link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-900 antialiased flex flex-col min-h-screen" style="font-family: 'Plus Jakarta Sans', sans-serif;">
    <header class="bg-white shadow-sm sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div class="flex-shrink-0 flex items-center">
                ${logoHtml}
            </div>
            <div class="hidden sm:flex items-center">
                ${phoneHtml}
            </div>
        </div>
    </header>

    <main class="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full relative">
        <div class="absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-gray-50 to-transparent -z-10"></div>
        ${seoContent}
    </main>

    <footer class="bg-gray-900 text-gray-300 py-12 mt-auto">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
            <div class="mb-4 md:mb-0">
                <p>&copy; ${new Date().getFullYear()} ${client.name}. All rights reserved.</p>
            </div>
            <div>
                ${footerLink}
            </div>
        </div>
    </footer>
    ${whatsAppHtml}
    <script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
    <script>AOS.init({ duration: 800, once: true });</script>
</body>
</html>`;
}
