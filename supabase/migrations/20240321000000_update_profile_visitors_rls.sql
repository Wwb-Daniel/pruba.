-- Drop the old update policy
DROP POLICY IF EXISTS "Users can update their visits" ON profile_visitors;

-- Create a new policy allowing profile owners to mark visits as viewed
CREATE POLICY "Profile owners can mark visits as viewed"
  ON profile_visitors FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id); 