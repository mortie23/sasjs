import { Link } from "./Link";

export interface Job {
  id: string;
  name: string;
  uri: string;
  createdBy: string;
  links: Link[];
}
