const paths = {
  chat: 'M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.4-3.2A7.5 7.5 0 1 1 20 11.5Z',
  outfit: 'm8 4-5 3 2 5 3-1v8h8v-8l3 1 2-5-5-3a4 4 0 0 1-8 0Z',
  friends: 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M20 21v-2a4 4 0 0 0-3-3.9M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM17 3.2a4 4 0 0 1 0 7.6',
  menu: 'M5 12h.01M12 12h.01M19 12h.01',
};

export default function IslandHudIcon({name}) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none"
    stroke="currentColor" strokeWidth={name === 'menu' ? 3 : 1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]}/>
  </svg>;
}
