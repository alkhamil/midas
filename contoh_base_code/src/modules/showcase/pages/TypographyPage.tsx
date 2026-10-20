import DocSection from '../components/DocSection';

const SCALE: { name: string; classes: string; sample: string }[] = [
  { name: 'Page (h1)', classes: 'text-lg font-semibold', sample: 'User List' },
  { name: 'Card title (h2)', classes: 'text-base font-semibold', sample: 'Account Information' },
  { name: 'Subtitle (h3)', classes: 'text-sm font-semibold', sample: 'Personal Data' },
  {
    name: 'Body',
    classes: 'text-sm font-normal',
    sample: 'Standard body text for paragraphs, value labels, and general content.',
  },
  {
    name: 'Small / secondary',
    classes: 'text-xs',
    sample: 'Helper text: field hints, table captions, timestamps.',
  },
  { name: 'Mono', classes: 'font-mono text-xs', sample: 'user.view, src/modules/user/' },
];

const TEXT_TOKENS: { name: string; classes: string }[] = [
  { name: 'text-foreground', classes: 'text-foreground' },
  { name: 'text-muted-foreground', classes: 'text-muted-foreground' },
  { name: 'text-primary', classes: 'text-primary' },
  { name: 'text-danger', classes: 'text-danger' },
  { name: 'text-success', classes: 'text-success' },
  { name: 'text-warning', classes: 'text-warning' },
  { name: 'text-info', classes: 'text-info' },
];

function TypographyPage() {
  return (
    <div className="flex flex-col section-gap">
      <DocSection
        title="Type scale"
        description="The scale used across the app. Page titles use text-lg, card titles text-base, body text text-sm."
      >
        <div className="flex flex-col stack-gap">
          {SCALE.map((item) => (
            <div key={item.name} className="grid grid-cols-[160px_1fr] items-baseline gap-4">
              <span className="font-mono text-xs text-muted-foreground">{item.name}</span>
              <p className={`${item.classes} text-foreground`}>{item.sample}</p>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection
        title="Text colors"
        description="Always use theme text color tokens — never hardcode hex or gray-500."
      >
        <div className="flex flex-col stack-gap">
          {TEXT_TOKENS.map((item) => (
            <div key={item.name} className="grid grid-cols-[160px_1fr] items-baseline gap-4">
              <span className="font-mono text-xs text-muted-foreground">{item.name}</span>
              <p className={`text-sm font-medium ${item.classes}`}>Sample text {item.name}</p>
            </div>
          ))}
        </div>
      </DocSection>
    </div>
  );
}

export default TypographyPage;
