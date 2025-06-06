import type { PlaintextPatch } from "src/types";

const coremodStr = "replugged.coremods.coremods.notices";

export default [
  {
    // Add the AnnouncementContainer to the AppView component children
    find: /hasNotice:\w+,sidebarTheme:\w+/,
    replacements: [
      {
        match: /\w+\.base,"data-fullscreen":\w+,children:\[/,
        replace: `$&${coremodStr}?.AnnouncementContainer?.(),`,
      },
    ],
  },
  {
    // Edit the NoticeStore's function "hasNotice" to return true if there are our notices
    // This is used in some places to decide whether to apply certain class names or not
    find: /"displayName","NoticeStore"/,
    replacements: [
      {
        match: /(hasNotice\(\){return )(null!=\w+&&null!=\w+\.type)/,
        replace: `$1($2)||replugged.notices.announcements.length>0`,
      },
    ],
  },
] as PlaintextPatch[];
