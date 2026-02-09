# GenLayer Chronicles — Intelligent Contract
# Deploy via GenLayer Studio or CLI: genlayer deploy --contract contracts/chronicles_game_master.py --args "Dark Fantasy Dungeon" 4

from genlayer.py.types import *
from genlayer.py.storage import *

import json


class StoryBeat:
    def __init__(self, text: str, choices: list[str]):
        self.text = text
        self.choices = choices
        self.votes: dict[str, int] = {}  # address -> choice_index
        self.chosen_index: int | None = None
        self.resolved: bool = False

    def to_dict(self):
        return {
            "text": self.text,
            "choices": self.choices,
            "votes": self.votes,
            "chosen_index": self.chosen_index,
            "resolved": self.resolved,
        }


class ChroniclesGameMaster(gl.Contract):
    theme: str
    max_players: int
    players: DynArray[str]
    started: bool
    finished: bool
    current_beat: int
    story_beats_json: DynArray[str]  # Serialized StoryBeat objects

    def __init__(self, theme: str, max_players: int):
        self.theme = theme
        self.max_players = max_players
        self.players = []
        self.started = False
        self.finished = False
        self.current_beat = 0
        self.story_beats_json = []

    @gl.public.write
    def join_game(self):
        caller = gl.msg.sender
        assert not self.started, "Game already started"
        assert len(self.players) < self.max_players, "Game is full"
        assert caller not in self.players, "Already joined"
        self.players.append(caller)

    @gl.public.write
    def start_game(self):
        assert len(self.players) >= 1, "Need at least 1 player"
        assert not self.started, "Game already started"
        self.started = True
        # Generate the first story beat
        self._generate_next_beat()

    @gl.public.write
    def vote(self, choice_index: int):
        assert self.started, "Game not started"
        assert not self.finished, "Game already finished"
        caller = gl.msg.sender
        assert caller in self.players, "Not a player"

        beat = self._get_current_beat()
        assert not beat.resolved, "Beat already resolved"
        assert 0 <= choice_index < len(beat.choices), "Invalid choice"
        assert caller not in beat.votes, "Already voted"

        beat.votes[caller] = choice_index
        self._save_beat(self.current_beat, beat)

        # Check if all players have voted
        if len(beat.votes) == len(self.players):
            self._resolve_vote()

    @gl.public.view
    def get_game_state(self) -> dict:
        beats = []
        for b_json in self.story_beats_json:
            beats.append(json.loads(b_json))
        return {
            "theme": self.theme,
            "players": list(self.players),
            "max_players": self.max_players,
            "started": self.started,
            "finished": self.finished,
            "current_beat": self.current_beat,
            "story_beats": beats,
        }

    @gl.public.view
    def get_players(self) -> list[str]:
        return list(self.players)

    @gl.public.view
    def get_story(self) -> list[dict]:
        return [json.loads(b) for b in self.story_beats_json]

    def _get_current_beat(self) -> StoryBeat:
        data = json.loads(self.story_beats_json[self.current_beat])
        beat = StoryBeat(data["text"], data["choices"])
        beat.votes = data["votes"]
        beat.chosen_index = data["chosen_index"]
        beat.resolved = data["resolved"]
        return beat

    def _save_beat(self, index: int, beat: StoryBeat):
        self.story_beats_json[index] = json.dumps(beat.to_dict())

    def _resolve_vote(self):
        beat = self._get_current_beat()
        # Count votes per choice
        vote_counts: dict[int, int] = {}
        for choice_idx in beat.votes.values():
            vote_counts[choice_idx] = vote_counts.get(choice_idx, 0) + 1

        # Find the winning choice (highest votes, ties broken by lowest index)
        max_votes = max(vote_counts.values())
        winning_choice = min(c for c, v in vote_counts.items() if v == max_votes)

        beat.chosen_index = winning_choice
        beat.resolved = True
        self._save_beat(self.current_beat, beat)

        # Check if story should end (after 5 beats)
        if self.current_beat >= 4:
            self.finished = True
        else:
            self.current_beat += 1
            self._generate_next_beat()

    def _generate_next_beat(self):
        # Build context from previous beats
        context = f"Theme: {self.theme}\n\n"
        for i, b_json in enumerate(self.story_beats_json):
            data = json.loads(b_json)
            context += f"Chapter {i + 1}: {data['text']}\n"
            if data["chosen_index"] is not None:
                context += f"Players chose: {data['choices'][data['chosen_index']]}\n\n"

        prompt = f"""You are an AI Game Master for a multiplayer text adventure.
{context}
Generate the next chapter of the story. The story should be immersive, 2-3 sentences long.
Then provide exactly 3-4 distinct choices for the players.

Respond in valid JSON format:
{{"text": "story text here", "choices": ["choice 1", "choice 2", "choice 3"]}}

{"This is the opening chapter. Set the scene dramatically." if len(self.story_beats_json) == 0 else "Continue the story based on the previous choices."}"""

        result = gl.exec_prompt(prompt)

        try:
            parsed = json.loads(result)
            beat = StoryBeat(parsed["text"], parsed["choices"])
        except (json.JSONDecodeError, KeyError):
            # Fallback if AI output is malformed
            beat = StoryBeat(
                result[:500] if result else "The story continues...",
                ["Press forward", "Look around", "Wait and observe"],
            )

        self.story_beats_json.append(json.dumps(beat.to_dict()))
