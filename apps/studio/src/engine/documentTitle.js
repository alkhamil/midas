// The browser tab's title: the open file's name, or the Home section, then the app name ("Untitled - Midas", "Recents - Midas").
export const HOME_NAV = [['recent', 'Recents'], ['all', 'All files'], ['templates', 'Templates'], ['library', 'Library'], ['trash', 'Trash']];

/** The title for what is on screen: the file when one is open, else the Home section's label. */
export function documentTitleOf({ inFile, fileName, view }) {
    const label = inFile ? fileName : HOME_NAV.find(([id]) => id === view)?.[1];
    return label ? `${label} - Midas` : 'Midas';
}
