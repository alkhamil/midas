// The only place in the app code that names the UI library package. Everything else imports components, icons and the
// theme from here, so switching library means changing this file, shared/ui/library.css and package.json (Midas Code Builder
// regenerates the two files for the library chosen in the project).
export * from '@midas/ui-standard';
