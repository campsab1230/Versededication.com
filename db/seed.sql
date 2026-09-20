-- ============================================================
-- VERSE 4 YOU — seed data (themes + 45 verses + theme links)
-- Run AFTER schema.sql in the Supabase SQL Editor.
-- Safe to re-run: uses ON CONFLICT DO NOTHING.
-- ============================================================

insert into themes (name, slug, sort_order) values
('Love & Marriage', 'love-marriage', 1),
('Strength & Courage', 'strength-courage', 2),
('Hope & Comfort', 'hope-comfort', 3),
('Peace', 'peace', 4),
('Guidance & Wisdom', 'guidance-wisdom', 5),
('Faith', 'faith', 6),
('Protection', 'protection', 7),
('New Baby / Child', 'new-baby', 8),
('Gratitude', 'gratitude', 9),
('Friendship', 'friendship', 10),
('Healing', 'healing', 11)
on conflict (name) do nothing;

insert into verses (book, chapter, verse_start, verse_end, reference, slug, text_kjv, featured) values
('1 Corinthians', 13, 4, 7, '1 Corinthians 13:4-7', '1-corinthians-13-4-7', 'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up... beareth all things, believeth all things, hopeth all things, endureth all things.', true),
('Song of Solomon', 8, 7, null, 'Song of Solomon 8:7', 'song-of-solomon-8-7', 'Many waters cannot quench love, neither can the floods drown it.', false),
('Ecclesiastes', 4, 9, 10, 'Ecclesiastes 4:9-10', 'ecclesiastes-4-9-10', 'Two are better than one; because they have a good reward for their labour.', false),
('Ruth', 1, 16, null, 'Ruth 1:16', 'ruth-1-16', 'Whither thou goest, I will go; and where thou lodgest, I will lodge: thy people shall be my people, and thy God my God.', false),
('Genesis', 2, 24, null, 'Genesis 2:24', 'genesis-2-24', 'Therefore shall a man leave his father and his mother, and shall cleave unto his wife: and they shall be one flesh.', false),

('Philippians', 4, 13, null, 'Philippians 4:13', 'philippians-4-13', 'I can do all things through Christ which strengtheneth me.', true),
('Joshua', 1, 9, null, 'Joshua 1:9', 'joshua-1-9', 'Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee whithersoever thou goest.', true),
('Isaiah', 41, 10, null, 'Isaiah 41:10', 'isaiah-41-10', 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee.', false),
('Psalm', 27, 1, null, 'Psalm 27:1', 'psalm-27-1', 'The Lord is my light and my salvation; whom shall I fear?', false),
('2 Timothy', 1, 7, null, '2 Timothy 1:7', '2-timothy-1-7', 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.', false),

('Jeremiah', 29, 11, null, 'Jeremiah 29:11', 'jeremiah-29-11', 'For I know the thoughts that I think toward you, saith the Lord, thoughts of peace, and not of evil, to give you an expected end.', true),
('Psalm', 34, 18, null, 'Psalm 34:18', 'psalm-34-18', 'The Lord is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit.', false),
('Revelation', 21, 4, null, 'Revelation 21:4', 'revelation-21-4', 'And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying.', false),
('Matthew', 5, 4, null, 'Matthew 5:4', 'matthew-5-4', 'Blessed are they that mourn: for they shall be comforted.', false),
('Psalm', 147, 3, null, 'Psalm 147:3', 'psalm-147-3', 'He healeth the broken in heart, and bindeth up their wounds.', false),
('2 Corinthians', 1, 3, 4, '2 Corinthians 1:3-4', '2-corinthians-1-3-4', 'The Father of mercies, and the God of all comfort; who comforteth us in all our tribulation.', false),

('Philippians', 4, 6, 7, 'Philippians 4:6-7', 'philippians-4-6-7', 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.', false),
('John', 14, 27, null, 'John 14:27', 'john-14-27', 'Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you.', true),
('Isaiah', 26, 3, null, 'Isaiah 26:3', 'isaiah-26-3', 'Thou wilt keep him in perfect peace, whose mind is stayed on thee.', false),
('Psalm', 29, 11, null, 'Psalm 29:11', 'psalm-29-11', 'The Lord will give strength unto his people; the Lord will bless his people with peace.', false),

('Proverbs', 3, 5, 6, 'Proverbs 3:5-6', 'proverbs-3-5-6', 'Trust in the Lord with all thine heart; and lean not unto thine own understanding.', true),
('Psalm', 119, 105, null, 'Psalm 119:105', 'psalm-119-105', 'Thy word is a lamp unto my feet, and a light unto my path.', true),
('James', 1, 5, null, 'James 1:5', 'james-1-5', 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally.', false),
('Proverbs', 16, 9, null, 'Proverbs 16:9', 'proverbs-16-9', 'A man''s heart deviseth his way: but the Lord directeth his steps.', false),

('Hebrews', 11, 1, null, 'Hebrews 11:1', 'hebrews-11-1', 'Now faith is the substance of things hoped for, the evidence of things not seen.', false),
('Romans', 8, 28, null, 'Romans 8:28', 'romans-8-28', 'And we know that all things work together for good to them that love God.', true),
('Mark', 11, 24, null, 'Mark 11:24', 'mark-11-24', 'What things soever ye desire, when ye pray, believe that ye receive them, and ye shall have them.', false),
('Matthew', 17, 20, null, 'Matthew 17:20', 'matthew-17-20', 'If ye have faith as a grain of mustard seed... nothing shall be impossible unto you.', false),

('Psalm', 91, 11, null, 'Psalm 91:11', 'psalm-91-11', 'For he shall give his angels charge over thee, to keep thee in all thy ways.', false),
('Psalm', 23, 1, 4, 'Psalm 23:1-4', 'psalm-23-1-4', 'The Lord is my shepherd; I shall not want... Yea, though I walk through the valley of the shadow of death, I will fear no evil.', true),
('Deuteronomy', 31, 6, null, 'Deuteronomy 31:6', 'deuteronomy-31-6', 'Be strong and of a good courage, fear not... for the Lord thy God, he it is that doth go with thee.', false),
('Numbers', 6, 24, 26, 'Numbers 6:24-26', 'numbers-6-24-26', 'The Lord bless thee, and keep thee: the Lord make his face shine upon thee, and be gracious unto thee.', true),

('Psalm', 127, 3, null, 'Psalm 127:3', 'psalm-127-3', 'Lo, children are an heritage of the Lord: and the fruit of the womb is his reward.', false),
('Jeremiah', 1, 5, null, 'Jeremiah 1:5', 'jeremiah-1-5', 'Before I formed thee in the belly I knew thee; and before thou camest forth out of the womb I sanctified thee.', false),
('Proverbs', 22, 6, null, 'Proverbs 22:6', 'proverbs-22-6', 'Train up a child in the way he should go: and when he is old, he will not depart from it.', false),
('Isaiah', 40, 11, null, 'Isaiah 40:11', 'isaiah-40-11', 'He shall gather the lambs with his arm, and carry them in his bosom.', false),

('1 Thessalonians', 5, 18, null, '1 Thessalonians 5:18', '1-thessalonians-5-18', 'In every thing give thanks: for this is the will of God in Christ Jesus concerning you.', false),
('Psalm', 100, 4, 5, 'Psalm 100:4-5', 'psalm-100-4-5', 'Enter into his gates with thanksgiving, and into his courts with praise.', false),
('James', 1, 17, null, 'James 1:17', 'james-1-17', 'Every good gift and every perfect gift is from above, and cometh down from the Father of lights.', false),

('Proverbs', 17, 17, null, 'Proverbs 17:17', 'proverbs-17-17', 'A friend loveth at all times, and a brother is born for adversity.', false),
('Ecclesiastes', 4, 12, null, 'Ecclesiastes 4:12', 'ecclesiastes-4-12', 'And if one prevail against him, two shall withstand him; and a threefold cord is not quickly broken.', false),
('John', 15, 13, null, 'John 15:13', 'john-15-13', 'Greater love hath no man than this, that a man lay down his life for his friends.', false),

('Jeremiah', 17, 14, null, 'Jeremiah 17:14', 'jeremiah-17-14', 'Heal me, O Lord, and I shall be healed; save me, and I shall be saved.', false),
('3 John', 1, 2, null, '3 John 1:2', '3-john-1-2', 'Beloved, I wish above all things that thou mayest prosper and be in health.', false),
('Psalm', 30, 2, null, 'Psalm 30:2', 'psalm-30-2', 'O Lord my God, I cried unto thee, and thou hast healed me.', false)
on conflict (reference) do nothing;

insert into verse_themes (verse_id, theme_id)
select v.id, t.id from verses v, themes t where (v.slug, t.slug) in (
  ('1-corinthians-13-4-7','love-marriage'),('song-of-solomon-8-7','love-marriage'),
  ('ecclesiastes-4-9-10','love-marriage'),('ruth-1-16','love-marriage'),('genesis-2-24','love-marriage'),
  ('philippians-4-13','strength-courage'),('joshua-1-9','strength-courage'),('isaiah-41-10','strength-courage'),
  ('psalm-27-1','strength-courage'),('2-timothy-1-7','strength-courage'),
  ('jeremiah-29-11','hope-comfort'),('psalm-34-18','hope-comfort'),('revelation-21-4','hope-comfort'),
  ('matthew-5-4','hope-comfort'),('psalm-147-3','hope-comfort'),('2-corinthians-1-3-4','hope-comfort'),
  ('philippians-4-6-7','peace'),('john-14-27','peace'),('isaiah-26-3','peace'),('psalm-29-11','peace'),
  ('proverbs-3-5-6','guidance-wisdom'),('psalm-119-105','guidance-wisdom'),('james-1-5','guidance-wisdom'),('proverbs-16-9','guidance-wisdom'),
  ('hebrews-11-1','faith'),('romans-8-28','faith'),('mark-11-24','faith'),('matthew-17-20','faith'),
  ('psalm-91-11','protection'),('psalm-23-1-4','protection'),('deuteronomy-31-6','protection'),('numbers-6-24-26','protection'),
  ('psalm-127-3','new-baby'),('jeremiah-1-5','new-baby'),('proverbs-22-6','new-baby'),('isaiah-40-11','new-baby'),
  ('1-thessalonians-5-18','gratitude'),('psalm-100-4-5','gratitude'),('james-1-17','gratitude'),
  ('proverbs-17-17','friendship'),('ecclesiastes-4-12','friendship'),('john-15-13','friendship'),
  ('jeremiah-17-14','healing'),('3-john-1-2','healing'),('psalm-30-2','healing')
)
on conflict do nothing;
