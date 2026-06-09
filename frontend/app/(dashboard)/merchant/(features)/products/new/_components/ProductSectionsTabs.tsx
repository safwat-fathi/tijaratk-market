import type { ProductSection, SectionTab } from '../_utils/product-onboarding.types';

type ProductSectionsTabsProps = {
  sectionTabs: SectionTab[];
  activeSection: ProductSection;
  onSectionChange: (section: ProductSection) => void;
};

export default function ProductSectionsTabs({
  sectionTabs,
  activeSection,
  onSectionChange,
}: ProductSectionsTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="أقسام إدارة المنتجات"
      className={`grid gap-2 rounded-xl bg-gray-50 p-1 ${
        sectionTabs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
      }`}
    >
      {sectionTabs.map((section) => {
        const isActive = activeSection === section.key;

        return (
          <button
            key={section.key}
            id={`section-tab-${section.key}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`section-panel-${section.key}`}
            onClick={() => onSectionChange(section.key)}
            className={`rounded-md px-2 py-2 text-center transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 ${
              isActive
                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-600 hover:bg-white'
            }`}
          >
            <span className="block text-sm font-semibold">{section.label}</span>
            <span className="block text-[11px] text-gray-500">{section.description}</span>
          </button>
        );
      })}
    </div>
  );
}
