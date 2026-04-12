ALTER TABLE stories
  DROP CONSTRAINT IF EXISTS stories_illustration_style_check;

ALTER TABLE stories
  ADD CONSTRAINT stories_illustration_style_check
  CHECK (
    illustration_style IS NULL OR
    illustration_style IN (
      'watercolor',
      'rough_drawing',
      'pastel',
      'collage',
      'woodblock',
      'cartoon_comic',
      'anime',
      'caricature',
      'three_d_clay',
      'stop_motion',
      'three_d_animation',
      'three_d_chibi'
    )
  );
