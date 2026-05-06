export interface ComponentData {
  headline?: string;
  subheadline?: string;
  body?: string;
  ctaText?: string;
  ctaLink?: string;
  imageUrl?: string;
  paragraphs?: string[];
  items?: {
    title?: string;
    description?: string;
    icon?: string;
  }[];
}

function renderHero(data: ComponentData, client: any): string {
  const ctaLink = data.ctaLink || '#contact';
  const ctaText = data.ctaText || 'Get Started';

  // FIXED: Dynamically use the client's name or a neutral fallback for the image placeholder
  const placeholderText = client?.name ? encodeURIComponent(client.name) : 'Welcome';
  const imageUrl = data.imageUrl || `https://placehold.co/600x400/f8fafc/0f172a?text=${placeholderText}`;

  return `
    <section class="py-16 sm:py-24 overflow-hidden">
      <div class="lg:grid lg:grid-cols-12 lg:gap-8 items-center">
        <div class="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left" data-aos="fade-up">
          <h1 class="text-4xl tracking-tight font-extrabold sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl">
            <!-- ADDED: line-clamp-3 to prevent massive headline blocks -->
            <span class="block bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent pb-1 line-clamp-3">${data.headline || 'Welcome'}</span>
          </h1>
          <!-- ADDED: line-clamp-3 to protect the subheadline -->
          <p class="mt-3 text-base text-gray-500 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl line-clamp-3">
            ${data.subheadline || 'Explore our services and find exactly what you need.'}
          </p>
          <div class="mt-8 sm:max-w-lg sm:mx-auto sm:text-center lg:text-left lg:mx-0">
            <a href="${ctaLink}" class="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-md text-white hover:-translate-y-1 hover:shadow-xl transition-all duration-300 md:py-4 md:text-lg md:px-10" style="background-color: ${client.primaryColor || '#0f172a'}">
              ${ctaText}
            </a>
          </div>
        </div>
        <div class="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
          <div class="relative mx-auto w-full rounded-lg shadow-lg lg:max-w-md overflow-hidden">
            <img class="w-full object-cover aspect-video" src="${imageUrl}" alt="Hero Image">
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderProblemAgitation(data: ComponentData, client: any): string {
  return `
    <section class="py-16 sm:py-24 rounded-2xl my-16 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 shadow-2xl" data-aos="fade-up">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="text-3xl font-extrabold text-white sm:text-4xl line-clamp-2">
          ${data.headline || 'Identify the Challenge'}
        </h2>
        <p class="mt-4 text-xl text-gray-300 line-clamp-2">
          ${data.subheadline || 'Are you looking for a better approach?'}
        </p>
        <div class="mt-8 text-lg text-gray-400 space-y-4">
          <p class="line-clamp-4">${data.body || 'Many struggle to find the right solutions. We are here to help you navigate these challenges with expert guidance.'}</p>
        </div>
      </div>
    </section>
  `;
}

function renderServicesGrid(data: ComponentData, client: any): string {
  const items = data.items || [
    { title: 'Expert Service', description: 'Comprehensive coverage tailored to you.' },
    { title: 'Trusted Support', description: 'Reliable guidance every step of the way.' }
  ];

  const gridHtml = items.map((item, index) => `
    <div class="pt-6" data-aos="fade-up" data-aos-delay="${index * 100}">
      <div class="flow-root bg-white rounded-lg px-6 pb-8 shadow-sm border border-gray-100 h-full hover:shadow-md hover:-translate-y-1 transition-all duration-300">
        <div class="-mt-6">
          <div>
            <span class="inline-flex items-center justify-center p-3 rounded-md shadow-lg" style="background-color: ${client.primaryColor || '#0f172a'}">
              <i class="ph-light ph-check-circle text-2xl text-white"></i>
            </span>
          </div>
          <h3 class="mt-8 text-lg font-medium text-gray-900 tracking-tight line-clamp-2">${item.title}</h3>
          <p class="mt-5 text-base text-gray-500 line-clamp-3">${item.description}</p>
        </div>
      </div>
    </div>
  `).join('');

  return `
    <section class="py-16 bg-gray-50 relative my-8">
      <div class="max-w-md mx-auto text-center px-4 sm:max-w-3xl sm:px-6 lg:px-8 lg:max-w-7xl">
        <h2 class="text-base font-semibold tracking-wider uppercase" style="color: ${client.primaryColor || '#0f172a'}">Our Services</h2>
        <p class="mt-2 text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl line-clamp-2">
          ${data.headline || 'What we offer'}
        </p>
        <p class="mt-5 max-w-prose mx-auto text-xl text-gray-500 line-clamp-3">
          ${data.subheadline || 'Discover how we can help you achieve your goals.'}
        </p>
        <div class="mt-12">
          <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            ${gridHtml}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderFaq(data: ComponentData, client: any): string {
  const items = data.items || [
    { title: 'How do I get started?', description: 'Contact us today to book an initial consultation.' }
  ];

  const faqHtml = items.map(item => `
    <div class="pt-6 pb-6 border-b border-gray-200" data-aos="fade-right">
      <dt class="text-lg leading-6 font-medium text-gray-900">
        ${item.title}
      </dt>
      <dd class="mt-2 text-base text-gray-500">
        ${item.description}
      </dd>
    </div>
  `).join('');

  return `
    <section class="py-16 sm:py-24 my-8">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="max-w-3xl mx-auto divide-y-2 divide-gray-200">
          <h2 class="text-3xl font-extrabold text-gray-900 sm:text-4xl text-center mb-8">
            ${data.headline || 'Frequently Asked Questions'}
          </h2>
          <dl class="mt-6 space-y-6 divide-y divide-gray-200">
            ${faqHtml}
          </dl>
        </div>
      </div>
    </section>
  `;
}

function renderSeoArticle(data: ComponentData, client: any): string {
  const paragraphs = data.paragraphs || [
    'Learn more about our approach and how we deliver consistent results.'
  ];

  const paragraphsHtml = paragraphs.map(p => `<p class="mb-6 text-lg text-gray-600 leading-relaxed">${p}</p>`).join('');

  return `
    <section class="py-16 sm:py-24 bg-white my-16 shadow-sm rounded-2xl border border-gray-100" data-aos="fade-up">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="lg:grid lg:grid-cols-12 lg:gap-16">
          <div class="lg:col-span-5 mb-10 lg:mb-0">
            <h2 class="text-3xl font-extrabold text-gray-900 sm:text-4xl tracking-tight leading-tight line-clamp-3">
              ${data.headline || 'Detailed Overview'}
            </h2>
            ${data.subheadline ? `<p class="mt-4 text-xl text-gray-500 font-medium line-clamp-3">${data.subheadline}</p>` : ''}
          </div>
          <div class="lg:col-span-7">
            <div class="prose prose-lg prose-blue text-gray-600 max-w-none">
              ${paragraphsHtml}
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderCta(data: ComponentData, client: any): string {
  const ctaLink = data.ctaLink || `tel:${client.contactPhone || ''}`;
  const ctaText = data.ctaText || 'Contact Us Today';

  return `
    <section id="contact" class="my-16 overflow-hidden">
      <div class="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center lg:justify-between rounded-2xl shadow-2xl" style="background: linear-gradient(135deg, ${client.primaryColor || '#2563eb'}, #0f172a);" data-aos="zoom-in">
        <h2 class="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:max-w-2xl">
          <!-- ADDED: line-clamp to prevent massive blocks from pushing the button off screen -->
          <span class="block line-clamp-2">${data.headline || 'Take the next step'}</span>
          <span class="block mt-2 text-gray-200 opacity-90 text-2xl font-medium line-clamp-2">${data.subheadline || 'Get in touch with our team.'}</span>
        </h2>
        <div class="mt-8 flex lg:mt-0 lg:flex-shrink-0">
          <div class="inline-flex rounded-md shadow">
            <a href="${ctaLink}" class="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-md text-gray-900 bg-white hover:-translate-y-1 hover:shadow-xl transition-all duration-300 whitespace-nowrap">
              ${ctaText}
            </a>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function renderComponent(type: string, data: any, client: any): string {
  switch (type) {
    case 'hero':
      return renderHero(data, client);
    case 'problem':
      return renderProblemAgitation(data, client);
    case 'services':
      return renderServicesGrid(data, client);
    case 'seoArticle':
      return renderSeoArticle(data, client);
    case 'faq':
      return renderFaq(data, client);
    case 'cta':
      return renderCta(data, client);
    default:
      console.warn(`[Template Engine] Unknown component type: ${type}`);
      return '';
  }
}