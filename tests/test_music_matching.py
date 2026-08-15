import unittest

from music_matching import artist_search_aliases, track_title_aliases


class MatchingRegressionTests(unittest.TestCase):
    def test_korean_artist_aliases_are_case_insensitive(self):
        aliases = {item.casefold() for item in artist_search_aliases("ha yea song")}
        self.assertIn("송하예", aliases)
        self.assertIn("宋荷艺", aliases)

    def test_korean_title_aliases(self):
        titles = {item.casefold() for item in track_title_aliases(["Your Regards"], ["Ha Yea Song"])}
        self.assertIn("니 소식", titles)


if __name__ == "__main__":
    unittest.main()
