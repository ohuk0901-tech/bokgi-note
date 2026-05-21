export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  deletion_requested_at: string | null;
  delete_after: string | null;
  created_at: string;
  updated_at: string;
};

export type Folder = {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  delete_after: string | null;
};

export type Note = {
  id: string;
  user_id: string;
  folder_id: string;
  title: string;
  content: string;
  note_date: string;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  delete_after: string | null;
};

export type ReviewSession = {
  id: string;
  user_id: string;
  folder_id: string;
  title: string;
  content: string;
  review_date: string;
  editor_position: number;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  delete_after: string | null;
};

export type ReviewSource = {
  id: string;
  review_session_id: string;
  source_note_id: string | null;
  source_review_session_id: string | null;
  sort_order: number;
  created_at: string;
};

export type EditableReviewNote = {
  id: string;
  review_session_id: string;
  note_id: string;
  sort_order: number;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        Profile,
        Partial<Profile> & { id: string },
        Partial<Profile>
      >;
      folders: Table<
        Folder,
        Partial<Folder> & { user_id: string; name: string },
        Partial<Folder>
      >;
      notes: Table<
        Note,
        Partial<Note> & { user_id: string; folder_id: string },
        Partial<Note>
      >;
      review_sessions: Table<
        ReviewSession,
        Partial<ReviewSession> & {
          user_id: string;
          folder_id: string;
          title: string;
        },
        Partial<ReviewSession>
      >;
      review_sources: Table<
        ReviewSource,
        Partial<ReviewSource> & { review_session_id: string },
        Partial<ReviewSource>
      >;
      editable_review_notes: Table<
        EditableReviewNote,
        Partial<EditableReviewNote> & {
          review_session_id: string;
          note_id: string;
        },
        Partial<EditableReviewNote>
      >;
    };
    Functions: {
      purge_deleted_items: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type UnifiedItem = {
  id: string;
  item_type: "note" | "review_session";
  title: string;
  content: string;
  preview: string;
  display_date: string;
  created_at: string;
  updated_at: string;
  folder_id: string;
};

export type ReviewSourceItem = UnifiedItem & {
  sort_order: number;
};
