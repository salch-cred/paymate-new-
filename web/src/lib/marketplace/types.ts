export type Category =
  | 'logistics'
  | 'finance'
  | 'data'
  | 'language'
  | 'communication'
  | 'legal'
  | 'energy'
  | 'analytics'
  | 'healthcare'
  | 'iot';

export interface Plugin {
  id: string;
  name: string;
  displayName: string;
  description: string;
  longDescription: string;
  category: Category;
  price: number; // USDC per use
  author: string; // wallet address
  authorName: string;
  ipfsHash: string;
  usageCount: number;
  rating: number; // 0–5
  reviewCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  version: string;
  active: boolean;
  featured?: boolean;
  githubUrl?: string;
  docsUrl?: string;
}

export interface Review {
  id: string;
  pluginId: string;
  author: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface PlatformStats {
  totalPlugins: number;
  totalInstalls: number;
  totalDevelopers: number;
  totalCategories: number;
  totalVolume: number; // USDC
}

export interface PublishPluginPayload {
  name: string;
  displayName: string;
  description: string;
  longDescription: string;
  category: Category;
  price: number;
  authorName: string;
  authorAddress: string;
  ipfsHash: string;
  tags: string[];
  version: string;
  githubUrl?: string;
  docsUrl?: string;
}

export interface CategoryMeta {
  id: Category;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  count: number;
}
