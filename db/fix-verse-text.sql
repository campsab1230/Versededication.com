-- Verse Dedication — restore the full KJV text on 26 verses.
-- Supabase SQL Editor (project oesdrtslwqaycqyxqbqj) -> paste -> Run.
--
-- NOTE: the `verses` table has NO `updated_at` column (only `created_at`).
-- An earlier version of this file set updated_at and failed with
--   42703: column "updated_at" of relation "verses" does not exist
-- The text is now sourced verbatim from db/seed.sql in the repo.
--
-- Idempotent: re-running sets the same values.

update verses set text_kjv = 'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up, Doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil; Rejoiceth not in iniquity, but rejoiceth in the truth; Beareth all things, believeth all things, hopeth all things, endureth all things.'
  where reference = '1 Corinthians 13:4-7';
update verses set text_kjv = 'Blessed be God, even the Father of our Lord Jesus Christ, the Father of mercies, and the God of all comfort; Who comforteth us in all our tribulation, that we may be able to comfort them which are in any trouble, by the comfort wherewith we ourselves are comforted of God.'
  where reference = '2 Corinthians 1:3-4';
update verses set text_kjv = 'Beloved, I wish above all things that thou mayest prosper and be in health, even as thy soul prospereth.'
  where reference = '3 John 1:2';
update verses set text_kjv = 'Be strong and of a good courage, fear not, nor be afraid of them: for the Lord thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee.'
  where reference = 'Deuteronomy 31:6';
update verses set text_kjv = 'Two are better than one; because they have a good reward for their labour. For if they fall, the one will lift up his fellow: but woe to him that is alone when he falleth; for he hath not another to help him up.'
  where reference = 'Ecclesiastes 4:9-10';
update verses set text_kjv = 'Thou wilt keep him in perfect peace, whose mind is stayed on thee: because he trusteth in thee.'
  where reference = 'Isaiah 26:3';
update verses set text_kjv = 'He shall feed his flock like a shepherd: he shall gather the lambs with his arm, and carry them in his bosom, and shall gently lead those that are with young.'
  where reference = 'Isaiah 40:11';
update verses set text_kjv = 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.'
  where reference = 'Isaiah 41:10';
update verses set text_kjv = 'Every good gift and every perfect gift is from above, and cometh down from the Father of lights, with whom is no variableness, neither shadow of turning.'
  where reference = 'James 1:17';
update verses set text_kjv = 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.'
  where reference = 'James 1:5';
update verses set text_kjv = 'Before I formed thee in the belly I knew thee; and before thou camest forth out of the womb I sanctified thee, and I ordained thee a prophet unto the nations.'
  where reference = 'Jeremiah 1:5';
update verses set text_kjv = 'Heal me, O Lord, and I shall be healed; save me, and I shall be saved: for thou art my praise.'
  where reference = 'Jeremiah 17:14';
update verses set text_kjv = 'Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.'
  where reference = 'John 14:27';
update verses set text_kjv = 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee whithersoever thou goest.'
  where reference = 'Joshua 1:9';
update verses set text_kjv = 'Therefore I say unto you, What things soever ye desire, when ye pray, believe that ye receive them, and ye shall have them.'
  where reference = 'Mark 11:24';
update verses set text_kjv = 'And Jesus said unto them, Because of your unbelief: for verily I say unto you, If ye have faith as a grain of mustard seed, ye shall say unto this mountain, Remove hence to yonder place; and it shall remove; and nothing shall be impossible unto you.'
  where reference = 'Matthew 17:20';
update verses set text_kjv = 'The Lord bless thee, and keep thee: The Lord make his face shine upon thee, and be gracious unto thee: The Lord lift up his countenance upon thee, and give thee peace.'
  where reference = 'Numbers 6:24-26';
update verses set text_kjv = 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.'
  where reference = 'Philippians 4:6-7';
update verses set text_kjv = 'Trust in the Lord with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.'
  where reference = 'Proverbs 3:5-6';
update verses set text_kjv = 'Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name. For the Lord is good; his mercy is everlasting; and his truth endureth to all generations.'
  where reference = 'Psalm 100:4-5';
update verses set text_kjv = 'The Lord is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul: he leadeth me in the paths of righteousness for his name''s sake. Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.'
  where reference = 'Psalm 23:1-4';
update verses set text_kjv = 'The Lord is my light and my salvation; whom shall I fear? the Lord is the strength of my life; of whom shall I be afraid?'
  where reference = 'Psalm 27:1';
update verses set text_kjv = 'And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away.'
  where reference = 'Revelation 21:4';
update verses set text_kjv = 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.'
  where reference = 'Romans 8:28';
update verses set text_kjv = 'And Ruth said, Intreat me not to leave thee, or to return from following after thee: for whither thou goest, I will go; and where thou lodgest, I will lodge: thy people shall be my people, and thy God my God:'
  where reference = 'Ruth 1:16';
update verses set text_kjv = 'Many waters cannot quench love, neither can the floods drown it: if a man would give all the substance of his house for love, it would utterly be contemned.'
  where reference = 'Song of Solomon 8:7';
