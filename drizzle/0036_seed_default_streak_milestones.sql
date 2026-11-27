INSERT INTO `attendance_streak_milestones` (`milestone_code`, `title`, `description`, `required_streak`, `emoji_code`, `emoji_char`, `display_order`, `is_active`)
VALUES
  ('STREAK_5', 'First Spark', 'Attended 5 consecutive eligible classes.', 5, 'first_spark', '🔥', 1, true),
  ('STREAK_10', 'Consistency', 'Attended 10 consecutive eligible classes.', 10, 'consistency', '⚡', 2, true),
  ('STREAK_20', 'Dedicated', 'Attended 20 consecutive eligible classes.', 20, 'dedicated', '🏅', 3, true),
  ('STREAK_30', 'Rising Star', 'Attended 30 consecutive eligible classes.', 30, 'rising_star', '🚀', 4, true),
  ('STREAK_50', 'Diamond Discipline', 'Attended 50 consecutive eligible classes.', 50, 'diamond_discipline', '💎', 5, true),
  ('STREAK_75', 'Attendance Royalty', 'Attended 75 consecutive eligible classes.', 75, 'attendance_royalty', '👑', 6, true),
  ('STREAK_100', 'Champion', 'Attended 100 consecutive eligible classes.', 100, 'champion', '🏆', 7, true),
  ('STREAK_150', 'Legendary', 'Attended 150 consecutive eligible classes.', 150, 'legendary', '🌟', 8, true),
  ('STREAK_200', 'Attendance Legend', 'Attended 200 consecutive eligible classes.', 200, 'attendance_legend', '🎓', 9, true)
ON DUPLICATE KEY UPDATE
  `milestone_code` = `milestone_code`;
