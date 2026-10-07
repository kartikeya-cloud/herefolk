export type Venue = {
  id: string;
  name: string;
  category: string;
  address: string;
  description: string;
  cover: string;
  tags: string[];
};
export type Profile = { id: string; display_name: string; bio: string };
export type Checkin = {
  id: string;
  user_id: string;
  venue_id: string;
  expires_at: string;
};
export type Post = {
  id: string;
  user_id: string;
  venue_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
};
export type Request = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
};
export const venues: Venue[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "The Reading Room",
    category: "Café",
    address: "Civil Lines, Delhi",
    description:
      "Good coffee. Quiet corners. A little room for a new conversation.",
    cover: "cafe",
    tags: ["Coffee & conversation", "Work-friendly"],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Common Ground",
    category: "Coworking",
    address: "Connaught Place, Delhi",
    description:
      "A welcoming space for makers, independent thinkers, and your next big idea.",
    cover: "work",
    tags: ["Build together", "Community"],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "The Green Corner",
    category: "Outdoors",
    address: "Lodhi Garden, Delhi",
    description: "Slow down, step outside, and share a little fresh air.",
    cover: "park",
    tags: ["Fresh air", "Weekend walks"],
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Studio Twenty",
    category: "Events",
    address: "Hauz Khas, Delhi",
    description:
      "Small gatherings, creative workshops, and people with stories to share.",
    cover: "studio",
    tags: ["Creative people", "Meetups"],
  },
];
export const demoMe: Profile = {
  id: "demo-you",
  display_name: "Kartikeya",
  bio: "Building things. Always up for a coffee and a good conversation.",
};
export const demoPeople: Profile[] = [
  {
    id: "demo-a",
    display_name: "Ananya",
    bio: "Designing interfaces & looking for good coffee.",
  },
  {
    id: "demo-b",
    display_name: "Rohan",
    bio: "React developer. Working on a weekend project.",
  },
  {
    id: "demo-c",
    display_name: "Meera",
    bio: "Books, photography, and the little things.",
  },
];
export function seedPosts(): Post[] {
  return [
    {
      id: "seed-a",
      user_id: "demo-a",
      venue_id: venues[0].id,
      content:
        "Taking a little break from Figma. Anyone up for a coffee and a conversation? ☕",
      created_at: new Date(Date.now() - 12 * 60000).toISOString(),
      profiles: demoPeople[0],
    },
    {
      id: "seed-b",
      user_id: "demo-b",
      venue_id: venues[0].id,
      content:
        "Working on a little React project by the window. Happy to swap ideas with other builders!",
      created_at: new Date(Date.now() - 27 * 60000).toISOString(),
      profiles: demoPeople[1],
    },
  ];
}
