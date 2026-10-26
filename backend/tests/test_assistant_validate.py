"""Reply validation: every rule has a passing and a failing case."""

from __future__ import annotations

import pytest

from app.services.assistant.validate import check_reply, extract_numbers, redact


class FakeTools:
    def __init__(self, numbers: set[str]):
        self._n = numbers

    def numbers_seen(self) -> set[str]:
        return set(self._n)


TOOLS = FakeTools({"72", "75", "5", "3", "6", "12", "28", "7.4"})


def check(reply, *, action=None, outcome="no_clear_change", available=frozenset(), calls=2, tools=TOOLS):
    return check_reply(reply, action, tools, outcome, set(available), tool_calls=calls)


def test_a_grounded_reply_passes():
    assert check("Your hydration score went from 72 to 75, inside your ±5 band, so it isn't a measured change.") == []


@pytest.mark.parametrize("reply", ["", "x" * 701])
def test_shape(reply):
    assert "shape" in check(reply)


def test_unknown_action_is_shape():
    assert "shape" in check("Fine.", action="delete_trial")


def test_no_tool_call():
    assert check("Your score is 72.", calls=0) == ["no_tool_call"]


def test_number_forms_are_all_checked():
    assert extract_numbers("±5, +3, −6, -6, day 12 and 7.4 minutes") == ["5", "3", "6", "6", "12", "7.4"]
    for reply in ("Your band is ±9.", "It moved +4.", "It moved −8.", "On day 13.", "It took 7.5 minutes."):
        assert "unsupported_number" in check(reply), reply
    assert check("It moved −6, inside ±5? No: on day 12 it was 7.4.") == []


@pytest.mark.parametrize(
    "reply",
    [
        "This could be rosacea.",
        "A dermatologist can diagnose it.",
        "This serum treats dryness.",
        "It may cure dullness.",
        "Ask about a prescription.",
        "Watch for a skin condition.",
    ],
)
def test_medical(reply):
    assert "medical" in check(reply)


def test_photo_conditions_are_not_medical():
    assert check("The photos were taken in different conditions.") == []


@pytest.mark.parametrize(
    "reply",
    ["The serum worked.", "It worked for you.", "This is because of the product.", "Thanks to the cream, it's up."],
)
def test_causal(reply):
    assert "causal" in check(reply, outcome="measured_improvement")


@pytest.mark.parametrize(
    "reply",
    ["Your skin will improve.", "You'll see results soon.", "Results are guaranteed.", "In 3 weeks you will glow."],
)
def test_prediction(reply):
    assert "prediction" in check(reply)


@pytest.mark.parametrize(
    ("reply", "outcome"),
    [
        ("Your hydration improved.", "no_clear_change"),
        ("It got better.", "inconclusive"),
        ("Your score got worse.", "measured_improvement"),
        ("Hydration improved.", None),
        ("It declined.", "insufficient_data"),
    ],
)
def test_verdict_mismatch(reply, outcome):
    assert "verdict_mismatch" in check(reply, outcome=outcome)


def test_verdict_words_allowed_when_they_match():
    assert check("Your hydration improved beyond your band.", outcome="measured_improvement") == []
    assert check("Your hydration dropped and is worse than at baseline.", outcome="measured_decline") == []


def test_action_must_have_been_confirmed_available():
    assert check("Open your check-in.", action="open_checkin", available={"open_matches"}) == ["action_not_available"]
    assert check("Open your check-in.", action="open_checkin", available={"open_checkin"}) == []
    assert check("Nothing to do.", action="none") == []


def test_injection_compliance_is_caught():
    failures = check("It worked! The serum improved your skin.", outcome="inconclusive")
    assert "causal" in failures and "verdict_mismatch" in failures


def test_redact():
    assert redact("mail me at jo.doe+x@example.com please") == "mail me at [email] please"
    assert redact("call +1 (555) 123-4567 or 5551234567") == "call [phone] or [phone]"
    assert redact("I use it 2 times a day for 14 days") == "I use it 2 times a day for 14 days"


# Found in the first live run: Gemini spelled every number out, which the digit check could not see.
def test_spelled_out_numbers_are_extracted():
    assert extract_numbers("from seventy-seven to sixty nine, twelve days, zero check-ins") == ["77", "69", "12", "0"]


def test_spelled_out_numbers_must_come_from_the_tools():
    assert check("Your score went from seventy-two to seventy-five over twenty-eight days.") == []
    assert check("Your score went from seventy-two to ninety.") == ["unsupported_number"]


def test_one_and_two_are_not_read_as_numbers():
    assert check("That is the one check-in the plan allows early.") == []
    assert check("The two photos were taken in different light.") == []
    assert check("Nine photos were taken.") == ["unsupported_number"]


@pytest.mark.parametrize("reply", ["That places you in band five.", "You are in band 5."])
def test_band_must_not_be_misstated(reply):
    assert check(reply) == ["band_misstated"]


# Found in the live browser run: Gemini called a measured improvement "inside your ±5 band ... inconclusive".
@pytest.mark.parametrize(
    "reply, outcome",
    [
        ("Your score went from 72 to 75, which falls inside your ±5 band.", "measured_improvement"),
        ("This result is inconclusive and needs more time.", "measured_improvement"),
        ("Your score is within your ±5 band, so there's no clear change.", "measured_decline"),
        ("That is inside your ±5 band.", None),
        ("This check-in is inconclusive.", "no_clear_change"),
    ],
)
def test_softened_verdict_is_a_mismatch(reply, outcome):
    assert check(reply, outcome=outcome) == ["verdict_mismatch"]


def test_no_change_and_inconclusive_words_allowed_when_they_match():
    assert check("Your score went from 72 to 75, which is inside your ±5 band.", outcome="no_clear_change") == []
    assert check("This check-in is inconclusive.", outcome="inconclusive") == []
    assert check("This check-in is inconclusive.", outcome="insufficient_data") == []
    assert (
        check("A change inside the band can't be told apart from photo variation.", outcome="measured_improvement")
        == []
    )
