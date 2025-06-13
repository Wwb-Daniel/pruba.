-- Create function to get audio track usage
create or replace function get_audio_track_usage(limit_count integer default 6)
returns table (
  audio_track_id uuid,
  count bigint
) language sql security definer as $$
  select 
    audio_track_id,
    count(*) as count
  from videos
  where audio_track_id is not null
  group by audio_track_id
  order by count desc
  limit limit_count;
$$;

-- Grant execute permission to authenticated and anonymous users
grant execute on function get_audio_track_usage(integer) to authenticated, anon; 