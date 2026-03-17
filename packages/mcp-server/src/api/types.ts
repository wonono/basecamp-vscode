export interface Person {
  id: number;
  name: string;
  email_address: string;
  personable_type: string;
  title: string;
  bio?: string;
  location?: string;
  admin?: boolean;
  owner?: boolean;
  client?: boolean;
  employee?: boolean;
  time_zone?: string;
  avatar_url: string;
  company?: { id: number; name: string };
  can_ping?: boolean;
  can_manage_projects?: boolean;
  can_manage_people?: boolean;
}

export interface DockItem {
  id: number;
  title: string;
  name: string;
  enabled: boolean;
  position: number | null;
  url: string;
  app_url: string;
}

export interface Project {
  id: number;
  status: string;
  created_at: string;
  updated_at: string;
  name: string;
  description: string;
  purpose: string;
  clients_enabled: boolean;
  timesheet_enabled: boolean;
  color: string | null;
  bookmark_url: string;
  url: string;
  app_url: string;
  dock: DockItem[];
  bookmarked: boolean;
}

export interface ParentRef {
  id: number;
  title: string;
  type: string;
  url?: string;
  app_url?: string;
}

export interface BucketRef {
  id: number;
  name: string;
  type: string;
}

export interface CreatorRef {
  id: number;
  name: string;
  email_address?: string;
  avatar_url?: string;
}

export interface Campfire {
  id: number;
  status: string;
  visible_to_clients: boolean;
  created_at: string;
  updated_at: string;
  title: string;
  inherits_status: boolean;
  type: string;
  url: string;
  app_url: string;
  bookmark_url?: string;
  subscription_url?: string;
  position: number;
  bucket: BucketRef;
  creator: CreatorRef;
  topic: string;
  lines_url: string;
}

export interface CampfireLine {
  id: number;
  status: string;
  visible_to_clients: boolean;
  created_at: string;
  updated_at: string;
  title: string;
  inherits_status: boolean;
  type: string;
  url: string;
  app_url: string;
  boosts_count?: number;
  parent: ParentRef;
  bucket: BucketRef;
  creator: CreatorRef;
  content: string;
}

export interface MessageBoard {
  id: number;
  status: string;
  title: string;
  type: string;
  messages_count: number;
  messages_url: string;
  bucket: BucketRef;
  creator: CreatorRef;
}

export interface Message {
  id: number;
  status: string;
  visible_to_clients: boolean;
  created_at: string;
  updated_at: string;
  title: string;
  inherits_status: boolean;
  type: string;
  url: string;
  app_url: string;
  comments_count: number;
  comments_url: string;
  parent: ParentRef;
  bucket: BucketRef;
  creator: CreatorRef;
  content: string;
  subject: string;
}

export interface TodoSet {
  id: number;
  status: string;
  title: string;
  type: string;
  url: string;
  app_url: string;
  bucket: BucketRef;
  todolists_url: string;
}

export interface TodoList {
  id: number;
  status: string;
  title: string;
  type: string;
  parent: ParentRef;
  bucket: BucketRef;
  creator: CreatorRef;
  description: string;
  completed: boolean;
  completed_ratio: string;
  name: string;
  todos_url: string;
  comments_count: number;
}

export interface Todo {
  id: number;
  status: string;
  title: string;
  type: string;
  position: number;
  parent: ParentRef;
  bucket: BucketRef;
  creator: CreatorRef;
  description: string;
  completed: boolean;
  content: string;
  starts_on: string | null;
  due_on: string | null;
  assignees: CreatorRef[];
  completion_subscribers: CreatorRef[];
  completion_url: string;
  comments_count: number;
  comments_url: string;
}

export interface Comment {
  id: number;
  status: string;
  title: string;
  type: string;
  parent: ParentRef;
  bucket: BucketRef;
  creator: CreatorRef;
  created_at: string;
  updated_at?: string;
  content: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextPageUrl: string | null;
  totalCount: number | null;
}
