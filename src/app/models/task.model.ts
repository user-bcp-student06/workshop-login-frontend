export interface Task {
  title: string;
  description?: string;
  status: string;
  priority: string;
  owner?: string;
  label?: string;
}