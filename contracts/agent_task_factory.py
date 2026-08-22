# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# ProofWork AgentTaskFactory - deploys AgentTask child contracts and holds
# their GEN escrow. This is the contract deployed/hardcoded per network;
# AgentTask is never deployed directly.
#
# A close port of Polaris's TaskRegistry.sol (direct hire / delegation via
# submitDirectTask) + USDCEscrow.sol (reverse-auction payout: the agent gets
# paid its winning bid, not the full budget) + RecurringMarket.sol (one
# auction for the whole series, not one per occurrence).
#
# AGENT_TASK_CODE_B64 below is generated from agent_task.py - do not
# hand-edit it. Run `python3 contracts/generate_agent_factory.py` after
# changing agent_task.py to regenerate it.

from genlayer import *

from datetime import datetime, timezone
import base64
import hashlib
import json

RELEASE_WINDOW_SECONDS = 86400  # 24h dispute window before escrow auto-releases -
                                 # a deliberate ProofWork addition on top of Polaris,
                                 # which releases immediately; kept here for the same
                                 # settlement-safety reason the human task board has one.
STAKE_SLASH_BPS = 1000  # 10.00%, in basis points of the agent's current stake
BIDDING_WINDOW_SECONDS = 120  # short auction window, matching agent_task.py's
REPUTATION_FLOOR = 70  # minimum reputation required to bid (single task or series)
MAX_BIDS_PER_TASK = 50


def _capability_matches(agent_capabilities: str, required: str) -> bool:
    if not required.strip():
        return True
    return required.strip().lower() in agent_capabilities.lower()


def _price_score(price: int) -> float:
    if price <= 0:
        return 0.0
    return float(min(100, 100 // price))


def _speed_score(eta_hours: int) -> float:
    if eta_hours <= 1:
        return 100.0
    return float(100 // eta_hours)


def _rep_score(reputation: int) -> float:
    return float(min(reputation, 1000)) / 10.0


AGENT_TASK_CODE_B64 = "IyB7ICJEZXBlbmRzIjogInB5LWdlbmxheWVyOjFqYjQ1YWE4eW5oMmE5Yzl4bjNiN3FxaDhzbTVxOTNod2ZwN2pxbXdzZmhoOGpwejA5aDYiIH0KCiMgUHJvb2ZXb3JrIEFnZW50VGFzayAtIGEgc2luZ2xlIHVuaXQgb2YgYXV0b25vbW91cy1hZ2VudCB3b3JrOiBvcGVuIGZvcgojIGJpZGRpbmcsIGFzc2lnbmVkIHRvIHRoZSB3aW5uaW5nIGFnZW50LCB3b3JrZWQsIEFJLXZlcmlmaWVkLCBhbmQgc2V0dGxlZC4KIyBEZXBsb3llZCBhcyBhIGNoaWxkIG9mIEFnZW50VGFza0ZhY3RvcnkgKHNlZSBhZ2VudF90YXNrX2ZhY3RvcnkucHkpIC0gbm90CiMgZGVwbG95ZWQgZGlyZWN0bHkuCiMKIyBBIGNsb3NlIHBvcnQgb2YgUG9sYXJpcydzIFRhc2tSZWdpc3RyeS5zb2wgKyBCaWRFbmdpbmUuc29sIGJpZGRpbmcvc2NvcmluZywKIyBhZGFwdGVkIHRvIEdlbkxheWVyOiBBSS1jb25zZW5zdXMgdmVyaWZpY2F0aW9uIChnbC5lcV9wcmluY2lwbGUpIGluc3RlYWQgb2YKIyBhIHRydXN0ZWQtc2lnbmVyIHZlcmlmaWNhdGlvbiBvcmFjbGUgLSB0aGUgd2hvbGUgcmVhc29uIHRvIHVzZSBHZW5MYXllciBpbgojIHRoZSBmaXJzdCBwbGFjZSAtIGFuZCBhIGRldGVybWluaXN0aWMgcHNldWRvLXJhbmRvbSB0aWVicmVhayBpbnN0ZWFkIG9mCiMgUG9sYXJpcydzIGJsb2NrLnByZXZyYW5kYW8gKEdlblZNJ3MgZXhlY3V0aW9uIG1vZGVsIGhhcyBubyBtaW5lci1yZXZlYWxlZAojIHBlci1ibG9jayBlbnRyb3B5IHRvIGRyYXcgb24pOyBib3RoIGFyZSBlcXVhbGx5IG5vbi1jcnlwdG9ncmFwaGljIGJ5IGRlc2lnbgojIGFuZCBkb2N1bWVudGVkIGFzIHN1Y2gsIG9uIGJvdGggc2lkZXMuCgpmcm9tIGdlbmxheWVyIGltcG9ydCAqCgpmcm9tIGRhdGV0aW1lIGltcG9ydCBkYXRldGltZSwgdGltZXpvbmUKaW1wb3J0IGhhc2hsaWIKaW1wb3J0IGpzb24KCkVSUk9SX0VYUEVDVEVEID0gIltFWFBFQ1RFRF0iCkVSUk9SX0VYVEVSTkFMID0gIltFWFRFUk5BTF0iCkVSUk9SX1RSQU5TSUVOVCA9ICJbVFJBTlNJRU5UXSIKRVJST1JfTExNID0gIltMTE1fRVJST1JdIgoKQklERElOR19XSU5ET1dfU0VDT05EUyA9IDEyMCAgIyBzaG9ydCBhdWN0aW9uIHdpbmRvdywgYWdlbnRzIGJpZCBhdXRvbm9tb3VzbHkKUkVQVVRBVElPTl9GTE9PUiA9IDcwICAjIG1pbmltdW0gcmVwdXRhdGlvbiByZXF1aXJlZCB0byBwbGFjZSBhIGJpZApQQVNTX1NDT1JFID0gNzAgICMgQUkgc2NvcmUgKDAtMTAwKSByZXF1aXJlZCB0byBwYXNzIHZlcmlmaWNhdGlvbgpNQVhfRElTUFVURVMgPSAzCk1BWF9CSURTX1BFUl9UQVNLID0gNTAKCgpkZWYgX2NhcGFiaWxpdHlfbWF0Y2hlcyhhZ2VudF9jYXBhYmlsaXRpZXM6IHN0ciwgcmVxdWlyZWQ6IHN0cikgLT4gYm9vbDoKICAgIGlmIG5vdCByZXF1aXJlZC5zdHJpcCgpOgogICAgICAgIHJldHVybiBUcnVlCiAgICByZXR1cm4gcmVxdWlyZWQuc3RyaXAoKS5sb3dlcigpIGluIGFnZW50X2NhcGFiaWxpdGllcy5sb3dlcigpCgoKZGVmIF9wcmljZV9zY29yZShwcmljZTogaW50KSAtPiBmbG9hdDoKICAgIGlmIHByaWNlIDw9IDA6CiAgICAgICAgcmV0dXJuIDAuMAogICAgcmV0dXJuIGZsb2F0KG1pbigxMDAsIDEwMCAvLyBwcmljZSkpCgoKZGVmIF9zcGVlZF9zY29yZShldGFfaG91cnM6IGludCkgLT4gZmxvYXQ6CiAgICBpZiBldGFfaG91cnMgPD0gMToKICAgICAgICByZXR1cm4gMTAwLjAKICAgIHJldHVybiBmbG9hdCgxMDAgLy8gZXRhX2hvdXJzKQoKCmRlZiBfcmVwX3Njb3JlKHJlcHV0YXRpb246IGludCkgLT4gZmxvYXQ6CiAgICByZXR1cm4gZmxvYXQobWluKHJlcHV0YXRpb24sIDEwMDApKSAvIDEwLjAKCgpjbGFzcyBBZ2VudFRhc2soZ2wuQ29udHJhY3QpOgogICAgcmVxdWVzdGVyOiBzdHIKICAgIGZhY3Rvcnk6IHN0cgogICAgcmVnaXN0cnk6IHN0cgogICAgdGl0bGU6IHN0cgogICAgZGVzY3JpcHRpb246IHN0cgogICAgY3JpdGVyaWE6IHN0cgogICAgY2FwYWJpbGl0eV9yZXF1aXJlZDogc3RyCiAgICBidWRnZXQ6IHUyNTYKICAgIGRlYWRsaW5lOiB1MjU2CiAgICBiaWRkaW5nX2RlYWRsaW5lOiB1MjU2CiAgICBiaWRzOiBEeW5BcnJheVtzdHJdICAjIEpTT046IHsiYWdlbnQiOiBzdHIsICJwcmljZSI6IGludCwgImV0YV9ob3VycyI6IGludH0KICAgIGFzc2lnbmVkX2FnZW50OiBzdHIKICAgIGFzc2lnbmVkX3ByaWNlOiB1MjU2ICAjIHdpbm5pbmcgYmlkJ3MgcHJpY2UgKHdob2xlIEdFTikgLSB3aGF0IHRoZSBhZ2VudCBhY3R1YWxseSBnZXRzIHBhaWQKICAgIHN1Ym1pc3Npb25fdXJsOiBzdHIKICAgIHN1Ym1pc3Npb25fbm90ZTogc3RyCiAgICBzdWJtaXNzaW9uX3NuYXBzaG90OiBzdHIKICAgIHN0YXR1czogc3RyICAjICJvcGVuIiwgImFzc2lnbmVkIiwgInN1Ym1pdHRlZCIsICJ2ZXJpZmllZCIsICJyZWplY3RlZCIsCiAgICAgICAgICAgICAgICAgIyAiZGlzcHV0ZWQiLCAiY2FuY2VsbGVkIiwgImV4cGlyZWQiCiAgICB2ZXJpZmljYXRpb25fcmVzdWx0OiBzdHIKICAgIGRpc3B1dGVfY291bnQ6IHUyNTYKICAgIGRpc3B1dGVfcmVhc29uOiBzdHIKICAgIGNyZWF0ZWRfYXQ6IHUyNTYKICAgIHZlcmlmaWVkX2F0OiB1MjU2CgogICAgZGVmIF9faW5pdF9fKAogICAgICAgIHNlbGYsCiAgICAgICAgcmVxdWVzdGVyOiBzdHIsCiAgICAgICAgZmFjdG9yeTogc3RyLAogICAgICAgIHJlZ2lzdHJ5OiBzdHIsCiAgICAgICAgdGl0bGU6IHN0ciwKICAgICAgICBkZXNjcmlwdGlvbjogc3RyLAogICAgICAgIGNyaXRlcmlhOiBzdHIsCiAgICAgICAgY2FwYWJpbGl0eV9yZXF1aXJlZDogc3RyLAogICAgICAgIGJ1ZGdldDogaW50LAogICAgICAgIGRlYWRsaW5lOiBpbnQsCiAgICAgICAgZGlyZWN0X2FnZW50OiBzdHIsCiAgICAgICAgZGlyZWN0X3ByaWNlOiBpbnQsCiAgICApOgogICAgICAgIG5vdyA9IGludChkYXRldGltZS5ub3codGltZXpvbmUudXRjKS50aW1lc3RhbXAoKSkKICAgICAgICBhc3NlcnQgZGVhZGxpbmUgPiBub3csICJEZWFkbGluZSBtdXN0IGJlIGluIHRoZSBmdXR1cmUiCiAgICAgICAgc2VsZi5yZXF1ZXN0ZXIgPSByZXF1ZXN0ZXIKICAgICAgICBzZWxmLmZhY3RvcnkgPSBmYWN0b3J5CiAgICAgICAgc2VsZi5yZWdpc3RyeSA9IHJlZ2lzdHJ5CiAgICAgICAgc2VsZi50aXRsZSA9IHRpdGxlCiAgICAgICAgc2VsZi5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uCiAgICAgICAgc2VsZi5jcml0ZXJpYSA9IGNyaXRlcmlhCiAgICAgICAgc2VsZi5jYXBhYmlsaXR5X3JlcXVpcmVkID0gY2FwYWJpbGl0eV9yZXF1aXJlZAogICAgICAgIHNlbGYuYnVkZ2V0ID0gYnVkZ2V0CiAgICAgICAgc2VsZi5kZWFkbGluZSA9IGRlYWRsaW5lCiAgICAgICAgYmlkZGluZ19jbG9zZSA9IG5vdyArIEJJRERJTkdfV0lORE9XX1NFQ09ORFMKICAgICAgICBzZWxmLmJpZGRpbmdfZGVhZGxpbmUgPSBiaWRkaW5nX2Nsb3NlIGlmIGJpZGRpbmdfY2xvc2UgPCBkZWFkbGluZSBlbHNlIGRlYWRsaW5lCiAgICAgICAgc2VsZi5zdWJtaXNzaW9uX3VybCA9ICIiCiAgICAgICAgc2VsZi5zdWJtaXNzaW9uX25vdGUgPSAiIgogICAgICAgIHNlbGYuc3VibWlzc2lvbl9zbmFwc2hvdCA9ICIiCiAgICAgICAgc2VsZi52ZXJpZmljYXRpb25fcmVzdWx0ID0gIiIKICAgICAgICBzZWxmLmRpc3B1dGVfY291bnQgPSAwCiAgICAgICAgc2VsZi5kaXNwdXRlX3JlYXNvbiA9ICIiCiAgICAgICAgc2VsZi5jcmVhdGVkX2F0ID0gbm93CiAgICAgICAgc2VsZi52ZXJpZmllZF9hdCA9IDAKCiAgICAgICAgaWYgZGlyZWN0X2FnZW50OgogICAgICAgICAgICAjIERpcmVjdCBoaXJlIC8gYWdlbnQtdG8tYWdlbnQgZGVsZWdhdGlvbiwgb3IgYSBjb21taXR0ZWQKICAgICAgICAgICAgIyBvY2N1cnJlbmNlIG9mIGEgcmVjdXJyaW5nIHNlcmllcyAtIHNraXBzIHRoZSBhdWN0aW9uIGVudGlyZWx5LgogICAgICAgICAgICAjIFRoZSBjYWxsZXIgKEFnZW50VGFza0ZhY3RvcnkpIGlzIHJlc3BvbnNpYmxlIGZvciB0ZWxsaW5nIHRoZQogICAgICAgICAgICAjIHJlZ2lzdHJ5IHRoaXMgYWdlbnQgbm93IGhhcyBhbiBhY3RpdmUgdGFzazsgX19pbml0X18gbmV2ZXIKICAgICAgICAgICAgIyBtYWtlcyBjcm9zcy1jb250cmFjdCBjYWxscyBpdHNlbGYuCiAgICAgICAgICAgIHNlbGYuYXNzaWduZWRfYWdlbnQgPSBkaXJlY3RfYWdlbnQKICAgICAgICAgICAgc2VsZi5hc3NpZ25lZF9wcmljZSA9IHUyNTYoZGlyZWN0X3ByaWNlKQogICAgICAgICAgICBzZWxmLnN0YXR1cyA9ICJhc3NpZ25lZCIKICAgICAgICBlbHNlOgogICAgICAgICAgICBzZWxmLmFzc2lnbmVkX2FnZW50ID0gIiIKICAgICAgICAgICAgc2VsZi5hc3NpZ25lZF9wcmljZSA9IHUyNTYoMCkKICAgICAgICAgICAgc2VsZi5zdGF0dXMgPSAib3BlbiIKCiAgICBAZ2wucHVibGljLndyaXRlCiAgICBkZWYgcGxhY2VfYmlkKHNlbGYsIHByaWNlOiBpbnQsIGV0YV9ob3VyczogaW50KSAtPiBOb25lOgogICAgICAgIGNhbGxlciA9IHN0cihnbC5tZXNzYWdlLnNlbmRlcl9hZGRyZXNzKQogICAgICAgIG5vdyA9IGludChkYXRldGltZS5ub3codGltZXpvbmUudXRjKS50aW1lc3RhbXAoKSkKICAgICAgICBhc3NlcnQgc2VsZi5zdGF0dXMgPT0gIm9wZW4iLCAiQmlkZGluZyBpcyBub3Qgb3BlbiIKICAgICAgICBhc3NlcnQgbm93IDw9IHNlbGYuYmlkZGluZ19kZWFkbGluZSwgIkJpZGRpbmcgd2luZG93IGhhcyBjbG9zZWQiCiAgICAgICAgYXNzZXJ0IHByaWNlID4gMCwgIlByaWNlIG11c3QgYmUgcG9zaXRpdmUiCiAgICAgICAgYXNzZXJ0IGV0YV9ob3VycyA+IDAsICJFVEEgbXVzdCBiZSBwb3NpdGl2ZSIKICAgICAgICBhc3NlcnQgbGVuKHNlbGYuYmlkcykgPCBNQVhfQklEU19QRVJfVEFTSywgIlRoaXMgdGFzayBoYXMgcmVhY2hlZCB0aGUgbWF4aW11bSBudW1iZXIgb2YgYmlkcyIKCiAgICAgICAgcmVnaXN0cnkgPSBnbC5nZXRfY29udHJhY3RfYXQoQWRkcmVzcyhzZWxmLnJlZ2lzdHJ5KSkKICAgICAgICBhZ2VudCA9IHJlZ2lzdHJ5LnZpZXcoKS5nZXRfYWdlbnQoY2FsbGVyKQogICAgICAgIGFzc2VydCBhZ2VudFsiYWN0aXZlIl0sICJPbmx5IGEgcmVnaXN0ZXJlZCwgYWN0aXZlIGFnZW50IGNhbiBiaWQiCiAgICAgICAgYXNzZXJ0IGludChhZ2VudFsicmVwdXRhdGlvbiJdKSA+PSBSRVBVVEFUSU9OX0ZMT09SLCAiUmVwdXRhdGlvbiBiZWxvdyB0aGUgYmlkZGluZyBmbG9vciIKICAgICAgICBhc3NlcnQgX2NhcGFiaWxpdHlfbWF0Y2hlcyhzdHIoYWdlbnRbImNhcGFiaWxpdGllcyJdKSwgc2VsZi5jYXBhYmlsaXR5X3JlcXVpcmVkKSwgXAogICAgICAgICAgICAiQWdlbnQgY2FwYWJpbGl0aWVzIGRvIG5vdCBtYXRjaCB0aGlzIHRhc2siCgogICAgICAgIGZvciByYXcgaW4gc2VsZi5iaWRzOgogICAgICAgICAgICBleGlzdGluZyA9IGpzb24ubG9hZHMocmF3KQogICAgICAgICAgICBhc3NlcnQgZXhpc3RpbmdbImFnZW50Il0gIT0gY2FsbGVyLCAiQWxyZWFkeSBwbGFjZWQgYSBiaWQgb24gdGhpcyB0YXNrIgoKICAgICAgICBzZWxmLmJpZHMuYXBwZW5kKGpzb24uZHVtcHMoeyJhZ2VudCI6IGNhbGxlciwgInByaWNlIjogcHJpY2UsICJldGFfaG91cnMiOiBldGFfaG91cnN9KSkKCiAgICBAZ2wucHVibGljLndyaXRlCiAgICBkZWYgY2xvc2VfYmlkZGluZ19hbmRfYXNzaWduKHNlbGYpIC0+IE5vbmU6CiAgICAgICAgbm93ID0gaW50KGRhdGV0aW1lLm5vdyh0aW1lem9uZS51dGMpLnRpbWVzdGFtcCgpKQogICAgICAgIGFzc2VydCBzZWxmLnN0YXR1cyA9PSAib3BlbiIsICJCaWRkaW5nIGlzIG5vdCBvcGVuIgogICAgICAgIGFzc2VydCBub3cgPiBzZWxmLmJpZGRpbmdfZGVhZGxpbmUsICJCaWRkaW5nIHdpbmRvdyBzdGlsbCBvcGVuIgoKICAgICAgICByZWdpc3RyeSA9IGdsLmdldF9jb250cmFjdF9hdChBZGRyZXNzKHNlbGYucmVnaXN0cnkpKQogICAgICAgIHBhcnNlZCA9IFtqc29uLmxvYWRzKHJhdykgZm9yIHJhdyBpbiBzZWxmLmJpZHNdCgogICAgICAgIGJlc3RfYWdlbnQgPSAiIgogICAgICAgIGJlc3RfcHJpY2UgPSAwCiAgICAgICAgYmVzdF9zY29yZSA9IC0xLjAKICAgICAgICBmb3IgaSwgYiBpbiBlbnVtZXJhdGUocGFyc2VkKToKICAgICAgICAgICAgYWdlbnRfaW5mbyA9IHJlZ2lzdHJ5LnZpZXcoKS5nZXRfYWdlbnQoYlsiYWdlbnQiXSkKICAgICAgICAgICAgaWYgbm90IGFnZW50X2luZm9bImFjdGl2ZSJdOgogICAgICAgICAgICAgICAgY29udGludWUgICMgYWdlbnQgd2VudCBvZmZsaW5lIHNpbmNlIGJpZGRpbmcgLSBza2lwLCBsaWtlIFBvbGFyaXMncyBhd2FyZEJpZAogICAgICAgICAgICBwcmljZSA9IGludChiWyJwcmljZSJdKQogICAgICAgICAgICBldGFfaG91cnMgPSBpbnQoYlsiZXRhX2hvdXJzIl0pCiAgICAgICAgICAgIHNlZWQgPSBmIntnbC5tZXNzYWdlLmNvbnRyYWN0X2FkZHJlc3N9OntiWydhZ2VudCddfTp7bm93fTp7aX0iLmVuY29kZSgpCiAgICAgICAgICAgIHJhbmRfc2NvcmUgPSBmbG9hdChpbnQoaGFzaGxpYi5zaGEyNTYoc2VlZCkuaGV4ZGlnZXN0KCksIDE2KSAlIDEwMSkKICAgICAgICAgICAgc2NvcmUgPSAoCiAgICAgICAgICAgICAgICBfcHJpY2Vfc2NvcmUocHJpY2UpICogMjUKICAgICAgICAgICAgICAgICsgX3JlcF9zY29yZShpbnQoYWdlbnRfaW5mb1sicmVwdXRhdGlvbiJdKSkgKiAxMAogICAgICAgICAgICAgICAgKyBfc3BlZWRfc2NvcmUoZXRhX2hvdXJzKSAqIDEwCiAgICAgICAgICAgICAgICArIHJhbmRfc2NvcmUgKiA1NQogICAgICAgICAgICApIC8gMTAwCiAgICAgICAgICAgIGlmIHNjb3JlID4gYmVzdF9zY29yZToKICAgICAgICAgICAgICAgIGJlc3Rfc2NvcmUgPSBzY29yZQogICAgICAgICAgICAgICAgYmVzdF9hZ2VudCA9IGJbImFnZW50Il0KICAgICAgICAgICAgICAgIGJlc3RfcHJpY2UgPSBwcmljZQoKICAgICAgICBpZiBub3QgYmVzdF9hZ2VudDoKICAgICAgICAgICAgc2VsZi5zdGF0dXMgPSAiZXhwaXJlZCIKICAgICAgICAgICAgcmV0dXJuCgogICAgICAgIHNlbGYuYXNzaWduZWRfYWdlbnQgPSBiZXN0X2FnZW50CiAgICAgICAgc2VsZi5hc3NpZ25lZF9wcmljZSA9IHUyNTYoYmVzdF9wcmljZSkKICAgICAgICBzZWxmLnN0YXR1cyA9ICJhc3NpZ25lZCIKICAgICAgICByZWdpc3RyeS5lbWl0KG9uPSJhY2NlcHRlZCIpLnJlY29yZF90YXNrX3N0YXJ0KGJlc3RfYWdlbnQpCgogICAgQGdsLnB1YmxpYy53cml0ZQogICAgZGVmIHN1Ym1pdF9kZWxpdmVyYWJsZShzZWxmLCBldmlkZW5jZV91cmw6IHN0ciwgc3VibWlzc2lvbl9ub3RlOiBzdHIpIC0+IE5vbmU6CiAgICAgICAgY2FsbGVyID0gc3RyKGdsLm1lc3NhZ2Uuc2VuZGVyX2FkZHJlc3MpCiAgICAgICAgbm93ID0gaW50KGRhdGV0aW1lLm5vdyh0aW1lem9uZS51dGMpLnRpbWVzdGFtcCgpKQogICAgICAgIGFzc2VydCBjYWxsZXIgPT0gc2VsZi5hc3NpZ25lZF9hZ2VudCwgIk9ubHkgdGhlIGFzc2lnbmVkIGFnZW50IGNhbiBzdWJtaXQiCiAgICAgICAgYXNzZXJ0IHNlbGYuc3RhdHVzID09ICJhc3NpZ25lZCIsICJUYXNrIG11c3QgYmUgYXNzaWduZWQgZmlyc3QiCiAgICAgICAgYXNzZXJ0IG5vdyA8PSBzZWxmLmRlYWRsaW5lLCAiVGFzayBkZWFkbGluZSBoYXMgcGFzc2VkIgoKICAgICAgICB1cmxfbG93ZXIgPSBldmlkZW5jZV91cmwubG93ZXIoKS5zdHJpcCgpCiAgICAgICAgYXNzZXJ0IHVybF9sb3dlci5zdGFydHN3aXRoKCJodHRwOi8vIikgb3IgdXJsX2xvd2VyLnN0YXJ0c3dpdGgoImh0dHBzOi8vIiksIFwKICAgICAgICAgICAgIkV2aWRlbmNlIG11c3QgYmUgYSB2YWxpZCBVUkwiCgogICAgICAgIGRlZiBmZXRjaF9ldmlkZW5jZSgpOgogICAgICAgICAgICB0cnk6CiAgICAgICAgICAgICAgICByZXR1cm4gZ2wubm9uZGV0LndlYi5yZW5kZXIoZXZpZGVuY2VfdXJsLCBtb2RlPSJ0ZXh0IilbOjgwMDBdCiAgICAgICAgICAgIGV4Y2VwdCBFeGNlcHRpb24gYXMgZToKICAgICAgICAgICAgICAgIHJhaXNlIGdsLnZtLlVzZXJFcnJvcihmIntFUlJPUl9UUkFOU0lFTlR9IGZhaWxlZCB0byBmZXRjaCB7ZXZpZGVuY2VfdXJsfToge2V9IikKCiAgICAgICAgY29tbWl0dGVkX2NvbnRlbnQgPSBnbC5lcV9wcmluY2lwbGUucHJvbXB0X2NvbXBhcmF0aXZlKAogICAgICAgICAgICBmZXRjaF9ldmlkZW5jZSwKICAgICAgICAgICAgcHJpbmNpcGxlPSgKICAgICAgICAgICAgICAgICJCb3RoIGZldGNoZXMgbXVzdCBiZSBvZiB0aGUgc2FtZSB1bmRlcmx5aW5nIHBhZ2Ugb3IgcmVzb3VyY2UuIE1pbm9yICIKICAgICAgICAgICAgICAgICJmb3JtYXR0aW5nIG9yIGluY2lkZW50YWwgZHluYW1pYyBlbGVtZW50cyAodGltZXN0YW1wcywgY291bnRlcnMpIG1heSAiCiAgICAgICAgICAgICAgICAiZGlmZmVyLCBidXQgdGhlIHN1YnN0YW50aXZlIGNvbnRlbnQgbXVzdCBtYXRjaC4iCiAgICAgICAgICAgICksCiAgICAgICAgKQoKICAgICAgICBzZWxmLnN1Ym1pc3Npb25fdXJsID0gZXZpZGVuY2VfdXJsCiAgICAgICAgc2VsZi5zdWJtaXNzaW9uX25vdGUgPSBzdWJtaXNzaW9uX25vdGUKICAgICAgICBzZWxmLnN1Ym1pc3Npb25fc25hcHNob3QgPSBjb21taXR0ZWRfY29udGVudAogICAgICAgIHNlbGYuc3RhdHVzID0gInN1Ym1pdHRlZCIKCiAgICBAZ2wucHVibGljLndyaXRlCiAgICBkZWYgY2hlY2tfdGltZW91dChzZWxmKSAtPiBOb25lOgogICAgICAgIG5vdyA9IGludChkYXRldGltZS5ub3codGltZXpvbmUudXRjKS50aW1lc3RhbXAoKSkKICAgICAgICBhc3NlcnQgc2VsZi5zdGF0dXMgPT0gImFzc2lnbmVkIiwgIlRhc2sgaXMgbm90IGF3YWl0aW5nIGEgc3VibWlzc2lvbiIKICAgICAgICBhc3NlcnQgbm93ID4gc2VsZi5kZWFkbGluZSwgIkRlYWRsaW5lIGhhcyBub3QgcGFzc2VkIHlldCIKICAgICAgICBzZWxmLnZlcmlmaWNhdGlvbl9yZXN1bHQgPSBqc29uLmR1bXBzKHsKICAgICAgICAgICAgInZlcmlmaWVkIjogRmFsc2UsCiAgICAgICAgICAgICJjb25maWRlbmNlIjogMTAwLAogICAgICAgICAgICAicmVhc29uaW5nIjogIlRoZSBhc3NpZ25lZCBhZ2VudCBtaXNzZWQgdGhlIHN1Ym1pc3Npb24gZGVhZGxpbmUuIiwKICAgICAgICB9KQogICAgICAgIHNlbGYuc3RhdHVzID0gInJlamVjdGVkIgogICAgICAgIHNlbGYudmVyaWZpZWRfYXQgPSBub3cKCiAgICBAZ2wucHVibGljLndyaXRlCiAgICBkZWYgcmVxdWVzdF92ZXJpZmljYXRpb24oc2VsZikgLT4gTm9uZToKICAgICAgICBjYWxsZXIgPSBzdHIoZ2wubWVzc2FnZS5zZW5kZXJfYWRkcmVzcykKICAgICAgICBhc3NlcnQgY2FsbGVyIGluIChzZWxmLnJlcXVlc3Rlciwgc2VsZi5hc3NpZ25lZF9hZ2VudCksIFwKICAgICAgICAgICAgIk9ubHkgdGhlIHJlcXVlc3RlciBvciBhc3NpZ25lZCBhZ2VudCBjYW4gcmVxdWVzdCB2ZXJpZmljYXRpb24iCiAgICAgICAgYXNzZXJ0IHNlbGYuc3RhdHVzIGluICgic3VibWl0dGVkIiwgImRpc3B1dGVkIiksICJUYXNrIG11c3QgYmUgc3VibWl0dGVkIG9yIGRpc3B1dGVkIHRvIHZlcmlmeSIKICAgICAgICBzZWxmLl92ZXJpZnlfc3VibWlzc2lvbigpCgogICAgQGdsLnB1YmxpYy53cml0ZQogICAgZGVmIGRpc3B1dGUoc2VsZiwgcmVhc29uOiBzdHIpIC0+IE5vbmU6CiAgICAgICAgY2FsbGVyID0gc3RyKGdsLm1lc3NhZ2Uuc2VuZGVyX2FkZHJlc3MpCiAgICAgICAgYXNzZXJ0IGNhbGxlciBpbiAoc2VsZi5yZXF1ZXN0ZXIsIHNlbGYuYXNzaWduZWRfYWdlbnQpLCAiT25seSB0aGUgcmVxdWVzdGVyIG9yIGFnZW50IGNhbiBkaXNwdXRlIgogICAgICAgIGFzc2VydCBzZWxmLnN0YXR1cyBpbiAoInZlcmlmaWVkIiwgInJlamVjdGVkIiksICJDYW4gb25seSBkaXNwdXRlIGEgZGVjaWRlZCB2ZXJpZmljYXRpb24iCiAgICAgICAgYXNzZXJ0IHNlbGYuZGlzcHV0ZV9jb3VudCA8IE1BWF9ESVNQVVRFUywgIk1heGltdW0gZGlzcHV0ZXMgcmVhY2hlZCAtIGRlY2lzaW9uIGlzIGZpbmFsIgogICAgICAgIHNlbGYuZGlzcHV0ZV9jb3VudCArPSAxCiAgICAgICAgc2VsZi5kaXNwdXRlX3JlYXNvbiA9IHJlYXNvbgogICAgICAgIHNlbGYuc3RhdHVzID0gImRpc3B1dGVkIgogICAgICAgIHNlbGYudmVyaWZpZWRfYXQgPSAwCgogICAgQGdsLnB1YmxpYy53cml0ZQogICAgZGVmIGNhbmNlbF90YXNrKHNlbGYpIC0+IE5vbmU6CiAgICAgICAgY2FsbGVyID0gc3RyKGdsLm1lc3NhZ2Uuc2VuZGVyX2FkZHJlc3MpCiAgICAgICAgYXNzZXJ0IGNhbGxlciA9PSBzZWxmLnJlcXVlc3RlciwgIk9ubHkgdGhlIHJlcXVlc3RlciBjYW4gY2FuY2VsIgogICAgICAgIGFzc2VydCBzZWxmLnN0YXR1cyA9PSAib3BlbiIsICJDYW4gb25seSBjYW5jZWwgYmVmb3JlIGJpZGRpbmcgY2xvc2VzIgogICAgICAgIHNlbGYuc3RhdHVzID0gImNhbmNlbGxlZCIKCiAgICBAZ2wucHVibGljLnZpZXcKICAgIGRlZiBnZXRfdGFza19zdGF0ZShzZWxmKSAtPiBkaWN0OgogICAgICAgIHJldHVybiB7CiAgICAgICAgICAgICJyZXF1ZXN0ZXIiOiBzZWxmLnJlcXVlc3RlciwKICAgICAgICAgICAgImZhY3RvcnkiOiBzZWxmLmZhY3RvcnksCiAgICAgICAgICAgICJyZWdpc3RyeSI6IHNlbGYucmVnaXN0cnksCiAgICAgICAgICAgICJ0aXRsZSI6IHNlbGYudGl0bGUsCiAgICAgICAgICAgICJkZXNjcmlwdGlvbiI6IHNlbGYuZGVzY3JpcHRpb24sCiAgICAgICAgICAgICJjcml0ZXJpYSI6IHNlbGYuY3JpdGVyaWEsCiAgICAgICAgICAgICJjYXBhYmlsaXR5X3JlcXVpcmVkIjogc2VsZi5jYXBhYmlsaXR5X3JlcXVpcmVkLAogICAgICAgICAgICAiYnVkZ2V0Ijogc2VsZi5idWRnZXQsCiAgICAgICAgICAgICJkZWFkbGluZSI6IHNlbGYuZGVhZGxpbmUsCiAgICAgICAgICAgICJiaWRkaW5nX2RlYWRsaW5lIjogc2VsZi5iaWRkaW5nX2RlYWRsaW5lLAogICAgICAgICAgICAiYmlkX2NvdW50IjogbGVuKHNlbGYuYmlkcyksCiAgICAgICAgICAgICJhc3NpZ25lZF9hZ2VudCI6IHNlbGYuYXNzaWduZWRfYWdlbnQsCiAgICAgICAgICAgICJhc3NpZ25lZF9wcmljZSI6IHNlbGYuYXNzaWduZWRfcHJpY2UsCiAgICAgICAgICAgICJzdWJtaXNzaW9uX3VybCI6IHNlbGYuc3VibWlzc2lvbl91cmwsCiAgICAgICAgICAgICJzdWJtaXNzaW9uX25vdGUiOiBzZWxmLnN1Ym1pc3Npb25fbm90ZSwKICAgICAgICAgICAgInN0YXR1cyI6IHNlbGYuc3RhdHVzLAogICAgICAgICAgICAidmVyaWZpY2F0aW9uX3Jlc3VsdCI6IHNlbGYudmVyaWZpY2F0aW9uX3Jlc3VsdCwKICAgICAgICAgICAgImRpc3B1dGVfY291bnQiOiBzZWxmLmRpc3B1dGVfY291bnQsCiAgICAgICAgICAgICJkaXNwdXRlX3JlYXNvbiI6IHNlbGYuZGlzcHV0ZV9yZWFzb24sCiAgICAgICAgICAgICJjcmVhdGVkX2F0Ijogc2VsZi5jcmVhdGVkX2F0LAogICAgICAgICAgICAidmVyaWZpZWRfYXQiOiBzZWxmLnZlcmlmaWVkX2F0LAogICAgICAgIH0KCiAgICBAZ2wucHVibGljLnZpZXcKICAgIGRlZiBnZXRfYXR0ZXN0YXRpb24oc2VsZikgLT4gZGljdDoKICAgICAgICAiIiJBIHBlcm1hbmVudCwgZXhwbGljaXQgcmVjb3JkIG9mIHRoZSB2ZXJkaWN0IC0gbWlycm9ycyBQb2xhcmlzJ3MKICAgICAgICBWZXJpZmllckJyaWRnZS5BdHRlc3RhdGlvbiAoYWdlbnQsIHBhc3NlZCwgc2NvcmUsIGRlbGl2ZXJhYmxlLAogICAgICAgIHRpbWVzdGFtcCksIHdoaWNoIGlzIHN0b3JlZCBhcyBpdHMgb3duIG9uLWNoYWluIHJlY29yZCB0aGVyZS4iIiIKICAgICAgICB2ZXJpZmllZCA9IE5vbmUKICAgICAgICBzY29yZSA9IDAKICAgICAgICBpZiBzZWxmLnZlcmlmaWNhdGlvbl9yZXN1bHQ6CiAgICAgICAgICAgIHBhcnNlZCA9IGpzb24ubG9hZHMoc2VsZi52ZXJpZmljYXRpb25fcmVzdWx0KQogICAgICAgICAgICB2ZXJpZmllZCA9IGJvb2wocGFyc2VkLmdldCgidmVyaWZpZWQiKSkKICAgICAgICAgICAgc2NvcmUgPSBpbnQocGFyc2VkLmdldCgiY29uZmlkZW5jZSIsIDApKQogICAgICAgIHJldHVybiB7CiAgICAgICAgICAgICJhZ2VudCI6IHNlbGYuYXNzaWduZWRfYWdlbnQsCiAgICAgICAgICAgICJwYXNzZWQiOiB2ZXJpZmllZCwKICAgICAgICAgICAgInNjb3JlIjogc2NvcmUsCiAgICAgICAgICAgICJkZWxpdmVyYWJsZV91cmwiOiBzZWxmLnN1Ym1pc3Npb25fdXJsLAogICAgICAgICAgICAidGltZXN0YW1wIjogc2VsZi52ZXJpZmllZF9hdCwKICAgICAgICB9CgogICAgQGdsLnB1YmxpYy52aWV3CiAgICBkZWYgZ2V0X2JpZHMoc2VsZikgLT4gbGlzdFtzdHJdOgogICAgICAgIHJldHVybiBbYiBmb3IgYiBpbiBzZWxmLmJpZHNdCgogICAgZGVmIF92ZXJpZnlfc3VibWlzc2lvbihzZWxmKToKICAgICAgICB0aXRsZSA9IHNlbGYudGl0bGUKICAgICAgICBkZXNjcmlwdGlvbiA9IHNlbGYuZGVzY3JpcHRpb24KICAgICAgICBjcml0ZXJpYSA9IHNlbGYuY3JpdGVyaWEKICAgICAgICBzdWJtaXNzaW9uX25vdGUgPSBzZWxmLnN1Ym1pc3Npb25fbm90ZQogICAgICAgIGRpc3B1dGVfcmVhc29uID0gc2VsZi5kaXNwdXRlX3JlYXNvbgogICAgICAgIGlzX3JlZGlzcHV0ZSA9IHNlbGYuZGlzcHV0ZV9jb3VudCA+IDAKICAgICAgICB3ZWJfZGF0YSA9IHNlbGYuc3VibWlzc2lvbl9zbmFwc2hvdAoKICAgICAgICBkZWYgYW5hbHl6ZSgpOgogICAgICAgICAgICBkaXNwdXRlX2NvbnRleHQgPSAiIgogICAgICAgICAgICBpZiBpc19yZWRpc3B1dGUgYW5kIGRpc3B1dGVfcmVhc29uOgogICAgICAgICAgICAgICAgZGlzcHV0ZV9jb250ZXh0ID0gZiIiIgpUaGlzIHN1Ym1pc3Npb24gd2FzIERJU1BVVEVEIGJ5IHRoZSByZXF1ZXN0ZXIgb3IgdGhlIGFnZW50LiBSZS1leGFtaW5lIHRoZSBldmlkZW5jZQpjYXJlZnVsbHkgaW4gbGlnaHQgb2YgdGhlIGRpc3B1dGUgcmVhc29uIGJlbG93LCBhbmQgZG8gbm90IHNpbXBseSByZXBlYXQgYSBwcmlvcgp2ZXJkaWN0IC0gZm9ybSB5b3VyIG93biBpbmRlcGVuZGVudCBqdWRnbWVudCBmcm9tIHRoZSBjdXJyZW50IGV2aWRlbmNlLgoKRElTUFVURSBSRUFTT046IHtkaXNwdXRlX3JlYXNvbn0KIiIiCiAgICAgICAgICAgIG5vdGVfY29udGV4dCA9IGYiXG5BR0VOVCdTIE5PVEU6IHtzdWJtaXNzaW9uX25vdGV9XG4iIGlmIHN1Ym1pc3Npb25fbm90ZSBlbHNlICIiCgogICAgICAgICAgICBwcm9tcHQgPSBmIiIiWW91IGFyZSBhbiBBSSByZXZpZXdlciBzY29yaW5nIGFuIGF1dG9ub21vdXMgYWdlbnQncyBjb21wbGV0ZWQgd29yay4KClRBU0sgVElUTEU6IHt0aXRsZX0KVEFTSyBERVNDUklQVElPTjoge2Rlc2NyaXB0aW9ufQpDT01QTEVUSU9OIENSSVRFUklBIChSVUJSSUMpOiB7Y3JpdGVyaWF9CgpTVUJNSVRURUQgREVMSVZFUkFCTEU6Cntub3RlX2NvbnRleHR9e2Rpc3B1dGVfY29udGV4dH0KREVMSVZFUkFCTEUgQ09OVEVOVDoKe3dlYl9kYXRhWzo4MDAwXX0KClNjb3JlIHRoZSBkZWxpdmVyYWJsZSBhZ2FpbnN0IHRoZSBydWJyaWMgb24gYSAwLTEwMCBzY2FsZS4gQSBzY29yZSBvZiB7UEFTU19TQ09SRX0gb3IKYWJvdmUgbWVhbnMgdGhlIHdvcmsgcGFzc2VzIGFuZCB0aGUgYWdlbnQgZ2V0cyBwYWlkOyBiZWxvdyB0aGF0LCBpdCBmYWlscyBhbmQgdGhlCmFnZW50IGlzIHBlbmFsaXplZC4KClJlc3BvbmQgaW4gdmFsaWQgSlNPTiBmb3JtYXQ6Cnt7InNjb3JlIjogMC0xMDAsICJyZWFzb25pbmciOiAiZGV0YWlsZWQgZXhwbGFuYXRpb24gb2YgeW91ciBzY29yaW5nIn19CgpCZSBzdHJpY3QgYnV0IGZhaXIuIiIiCgogICAgICAgICAgICByZXN1bHQgPSBnbC5ub25kZXQuZXhlY19wcm9tcHQocHJvbXB0LCByZXNwb25zZV9mb3JtYXQ9Impzb24iKQoKICAgICAgICAgICAgaWYgbm90IGlzaW5zdGFuY2UocmVzdWx0LCBkaWN0KSBvciAic2NvcmUiIG5vdCBpbiByZXN1bHQ6CiAgICAgICAgICAgICAgICByZXR1cm4geyJzY29yZSI6IDAsICJyZWFzb25pbmciOiAiQUkgc2NvcmluZyBwcm9kdWNlZCBtYWxmb3JtZWQgb3V0cHV0LiBNYW51YWwgcmV2aWV3IG5lZWRlZC4ifQoKICAgICAgICAgICAgdHJ5OgogICAgICAgICAgICAgICAgc2NvcmUgPSBtYXgoMCwgbWluKDEwMCwgaW50KHJvdW5kKGZsb2F0KHJlc3VsdC5nZXQoInNjb3JlIiwgMCkgb3IgMCkpKSkpCiAgICAgICAgICAgIGV4Y2VwdCAoVmFsdWVFcnJvciwgVHlwZUVycm9yKToKICAgICAgICAgICAgICAgIHNjb3JlID0gMAoKICAgICAgICAgICAgcmV0dXJuIHsic2NvcmUiOiBzY29yZSwgInJlYXNvbmluZyI6IHN0cihyZXN1bHQuZ2V0KCJyZWFzb25pbmciLCAiIikpfQoKICAgICAgICBwYXJzZWQgPSBnbC5lcV9wcmluY2lwbGUucHJvbXB0X2NvbXBhcmF0aXZlKAogICAgICAgICAgICBhbmFseXplLAogICAgICAgICAgICBwcmluY2lwbGU9KAogICAgICAgICAgICAgICAgImBzY29yZWAgc2hvdWxkIGJlIHdpdGhpbiAxNSBwb2ludHMgb2YgZWFjaCBvdGhlciBhbmQgb24gdGhlIHNhbWUgc2lkZSAiCiAgICAgICAgICAgICAgICAib2YgdGhlIHBhc3MvZmFpbCBsaW5lLiBgcmVhc29uaW5nYCBtYXkgZGlmZmVyIGluIHdvcmRpbmcgYnV0IHNob3VsZCAiCiAgICAgICAgICAgICAgICAicmVmZXJlbmNlIHNpbWlsYXIgZXZpZGVuY2UuIgogICAgICAgICAgICApLAogICAgICAgICkKCiAgICAgICAgbm93ID0gaW50KGRhdGV0aW1lLm5vdyh0aW1lem9uZS51dGMpLnRpbWVzdGFtcCgpKQogICAgICAgIHNjb3JlID0gaW50KHBhcnNlZC5nZXQoInNjb3JlIiwgMCkpCiAgICAgICAgcGFzc2VkID0gc2NvcmUgPj0gUEFTU19TQ09SRQogICAgICAgIHNlbGYudmVyaWZpY2F0aW9uX3Jlc3VsdCA9IGpzb24uZHVtcHMoewogICAgICAgICAgICAidmVyaWZpZWQiOiBwYXNzZWQsCiAgICAgICAgICAgICJjb25maWRlbmNlIjogc2NvcmUsCiAgICAgICAgICAgICJyZWFzb25pbmciOiBwYXJzZWQuZ2V0KCJyZWFzb25pbmciLCAiIiksCiAgICAgICAgfSkKICAgICAgICBzZWxmLnN0YXR1cyA9ICJ2ZXJpZmllZCIgaWYgcGFzc2VkIGVsc2UgInJlamVjdGVkIgogICAgICAgIHNlbGYudmVyaWZpZWRfYXQgPSBub3cK"


@gl.evm.contract_interface
class _Recipient:
    class View:
        pass

    class Write:
        pass


class AgentTaskFactory(gl.Contract):
    registry: str
    tasks: DynArray[Address]
    escrow: TreeMap[Address, u256]
    escrow_released: TreeMap[Address, bool]
    task_count: u256

    # Recurring series: Polaris's RecurringMarket runs ONE auction for the
    # whole series (an agent commits to all N deliveries at one agreed
    # price), not a fresh auction per occurrence. The requester pre-funds
    # every occurrence's ceiling up front in one payable call - GenLayer
    # contracts can't pull funds from a wallet later - and gets refunded the
    # gap between that ceiling and the winning price the moment it's awarded.
    next_series_id: u256
    series_task: TreeMap[Address, u256]  # deployed task address -> series id (0 = not part of a series)
    series_requester: TreeMap[u256, str]
    series_title: TreeMap[u256, str]
    series_description: TreeMap[u256, str]
    series_criteria: TreeMap[u256, str]
    series_capability: TreeMap[u256, str]
    series_budget: TreeMap[u256, u256]  # per-occurrence ceiling, atto-GEN
    series_duration: TreeMap[u256, u256]  # deadline_duration_seconds per occurrence
    series_interval: TreeMap[u256, u256]  # min gap before the next occurrence can be posted
    series_remaining: TreeMap[u256, u256]  # occurrences left, including the current one
    series_next_advance_at: TreeMap[u256, u256]
    series_active: TreeMap[u256, bool]
    series_awarded: TreeMap[u256, bool]
    series_bidding_deadline: TreeMap[u256, u256]
    series_bids_json: TreeMap[u256, str]  # JSON array string - avoids nested-collection storage
    series_committed_agent: TreeMap[u256, str]
    series_committed_price: TreeMap[u256, u256]  # per-occurrence price agents committed to, whole GEN

    def __init__(self, registry_address: str):
        self.registry = registry_address
        self.task_count = 0
        self.next_series_id = 0

    def _deploy_child_task(
        self,
        requester: str,
        title: str,
        description: str,
        criteria: str,
        capability_required: str,
        budget: int,
        deadline: int,
        direct_agent: str = "",
        direct_price: int = 0,
    ) -> Address:
        factory_address = str(gl.message.contract_address)
        task_code = base64.b64decode(AGENT_TASK_CODE_B64)
        addr = gl.deploy_contract(
            code=task_code,
            args=[
                requester,
                factory_address,
                self.registry,
                title,
                description,
                criteria,
                capability_required,
                budget,
                deadline,
                direct_agent,
                direct_price,
            ],
            salt_nonce=int(self.task_count) + 1,
            on="accepted",
        )
        self.tasks.append(addr)
        self.task_count += 1
        return addr

    @gl.public.write.payable
    def create_task(
        self,
        title: str,
        description: str,
        criteria: str,
        capability_required: str,
        budget: int,
        deadline: int,
    ) -> str:
        expected_value = u256(budget) * u256(10**18)
        assert gl.message.value == expected_value, "Sent value must equal budget GEN (in atto-GEN)"

        requester = str(gl.message.sender_address)
        addr = self._deploy_child_task(requester, title, description, criteria, capability_required, budget, deadline)
        self.escrow[addr] = gl.message.value
        self.escrow_released[addr] = False
        return str(addr)

    @gl.public.write.payable
    def create_direct_task(
        self,
        title: str,
        description: str,
        criteria: str,
        capability_required: str,
        agent_address: str,
        budget: int,
        deadline: int,
    ) -> str:
        """Direct hire, skipping the auction - also how agent-to-agent
        delegation works, since nothing stops an agent's own wallet from
        calling this as a requester to sub-contract another agent."""
        expected_value = u256(budget) * u256(10**18)
        assert gl.message.value == expected_value, "Sent value must equal budget GEN (in atto-GEN)"

        registry = gl.get_contract_at(Address(self.registry))
        agent = registry.view().get_agent(agent_address)
        assert agent["active"], "Agent is not active"
        assert int(agent["reputation"]) >= REPUTATION_FLOOR, "Agent reputation below the hiring floor"
        assert _capability_matches(str(agent["capabilities"]), capability_required), \
            "Agent capabilities do not match this task"

        requester = str(gl.message.sender_address)
        addr = self._deploy_child_task(
            requester, title, description, criteria, capability_required, budget, deadline,
            agent_address, budget,
        )
        self.escrow[addr] = gl.message.value
        self.escrow_released[addr] = False
        registry.emit(on="accepted").record_task_start(agent_address)
        return str(addr)

    @gl.public.write
    def release_funds(self, task_address: str) -> None:
        addr = Address(task_address)
        assert addr in self.escrow, "Unknown task"
        assert not self.escrow_released.get(addr, False), "Escrow already released"

        other = gl.get_contract_at(addr)
        state = other.view().get_task_state()

        status = state["status"]
        assert status in ("verified", "rejected", "cancelled", "expired"), \
            "Task has not reached a terminal state"

        amount = self.escrow[addr]
        self.escrow_released[addr] = True

        if status in ("verified", "rejected"):
            verified_at = int(state["verified_at"])
            assert verified_at > 0, "No verification timestamp recorded"
            now = int(datetime.now(timezone.utc).timestamp())
            assert now >= verified_at + RELEASE_WINDOW_SECONDS, "24h dispute window still open"

            if status == "verified":
                # Pay the agent exactly its committed price, refund the gap
                # to the requester - a real reverse auction, matching
                # Polaris's releaseSplit, not "winner takes the whole budget."
                assigned_price_atto = u256(int(state["assigned_price"])) * u256(10**18)
                pay_agent = assigned_price_atto if assigned_price_atto <= amount else amount
                refund_requester = amount - pay_agent
                if pay_agent > 0:
                    _Recipient(Address(state["assigned_agent"])).emit_transfer(value=pay_agent)
                if refund_requester > 0:
                    _Recipient(Address(state["requester"])).emit_transfer(value=refund_requester)
            else:
                _Recipient(Address(state["requester"])).emit_transfer(value=amount)

            if state["assigned_agent"]:
                registry = gl.get_contract_at(Address(self.registry))
                passed = status == "verified"
                verification = json.loads(state["verification_result"]) if state["verification_result"] else {}
                score = int(verification.get("confidence", 0))
                agent_info = registry.view().get_agent(state["assigned_agent"])
                current_stake = int(agent_info["stake"])

                if passed:
                    new_stake = current_stake
                else:
                    slash_amount = (current_stake * STAKE_SLASH_BPS) // 10000
                    new_stake = current_stake - slash_amount
                    if slash_amount > 0:
                        _Recipient(Address(state["requester"])).emit_transfer(value=slash_amount)

                registry.emit(on="accepted").record_task_outcome(
                    state["assigned_agent"], passed, score, new_stake
                )
        else:
            # cancelled/expired - full refund, no agent was ever paid.
            if amount > 0:
                _Recipient(Address(state["requester"])).emit_transfer(value=amount)

    @gl.public.write.payable
    def create_recurring_task(
        self,
        title: str,
        description: str,
        criteria: str,
        capability_required: str,
        budget_per_occurrence: int,
        deadline_duration_seconds: int,
        interval_seconds: int,
        occurrences: int,
    ) -> int:
        assert occurrences >= 1, "Must fund at least 1 occurrence"
        assert deadline_duration_seconds > 0, "Duration must be positive"
        assert interval_seconds >= 0, "Interval cannot be negative"
        expected_value = u256(budget_per_occurrence) * u256(occurrences) * u256(10**18)
        assert gl.message.value == expected_value, \
            "Sent value must equal budget_per_occurrence * occurrences GEN (in atto-GEN)"

        requester = str(gl.message.sender_address)
        now = int(datetime.now(timezone.utc).timestamp())

        self.next_series_id += 1
        series_id = self.next_series_id
        self.series_requester[series_id] = requester
        self.series_title[series_id] = title
        self.series_description[series_id] = description
        self.series_criteria[series_id] = criteria
        self.series_capability[series_id] = capability_required
        self.series_budget[series_id] = u256(budget_per_occurrence) * u256(10**18)
        self.series_duration[series_id] = u256(deadline_duration_seconds)
        self.series_interval[series_id] = u256(interval_seconds)
        self.series_remaining[series_id] = u256(occurrences)
        self.series_active[series_id] = True
        self.series_awarded[series_id] = False
        self.series_bidding_deadline[series_id] = u256(now + BIDDING_WINDOW_SECONDS)
        return int(series_id)

    @gl.public.write
    def bid_recurring_series(self, series_id: int, price_per_occurrence: int, eta_hours: int) -> None:
        sid = u256(series_id)
        caller = str(gl.message.sender_address)
        now = int(datetime.now(timezone.utc).timestamp())
        assert self.series_active.get(sid, False), "Series is not active"
        assert not self.series_awarded.get(sid, False), "Series has already been awarded"
        assert now <= int(self.series_bidding_deadline.get(sid, u256(0))), "Bidding window has closed"
        assert price_per_occurrence > 0, "Price must be positive"
        assert eta_hours > 0, "ETA must be positive"

        registry = gl.get_contract_at(Address(self.registry))
        agent = registry.view().get_agent(caller)
        assert agent["active"], "Only a registered, active agent can bid"
        assert int(agent["reputation"]) >= REPUTATION_FLOOR, "Reputation below the bidding floor"
        assert _capability_matches(str(agent["capabilities"]), self.series_capability[sid]), \
            "Agent capabilities do not match this series"

        raw = self.series_bids_json.get(sid, "")
        bids = json.loads(raw) if raw else []
        assert len(bids) < MAX_BIDS_PER_TASK, "This series has reached the maximum number of bids"
        for b in bids:
            assert b["agent"] != caller, "Already placed a bid on this series"
        bids.append({"agent": caller, "price": price_per_occurrence, "eta_hours": eta_hours})
        self.series_bids_json[sid] = json.dumps(bids)

    @gl.public.write
    def award_recurring_series(self, series_id: int) -> str:
        """Ends the series-wide auction: the winner commits to fulfilling
        every remaining occurrence at its bid price. One auction total, not
        one per occurrence - matching Polaris's RecurringMarket."""
        sid = u256(series_id)
        now = int(datetime.now(timezone.utc).timestamp())
        assert self.series_active.get(sid, False), "Series is not active"
        assert not self.series_awarded.get(sid, False), "Series has already been awarded"
        assert now > int(self.series_bidding_deadline.get(sid, u256(0))), "Bidding window still open"

        requester = self.series_requester[sid]
        occurrences = self.series_remaining[sid]
        budget_atto = self.series_budget[sid]

        raw = self.series_bids_json.get(sid, "")
        bids = json.loads(raw) if raw else []

        registry = gl.get_contract_at(Address(self.registry))
        best_agent = ""
        best_price = 0
        best_score = -1.0
        for b in bids:
            agent_info = registry.view().get_agent(b["agent"])
            if not agent_info["active"]:
                continue
            price = int(b["price"])
            eta_hours = int(b["eta_hours"])
            score = (
                _price_score(price) * 40
                + _rep_score(int(agent_info["reputation"])) * 40
                + _speed_score(eta_hours) * 20
            ) / 100
            if score > best_score:
                best_score = score
                best_agent = b["agent"]
                best_price = price

        if not best_agent:
            # No (usable) bids - refund the entire pre-funded pool, series dies.
            self.series_active[sid] = False
            total_pool = budget_atto * occurrences
            if total_pool > 0:
                _Recipient(Address(requester)).emit_transfer(value=total_pool)
            return ""

        winning_price_atto = u256(best_price) * u256(10**18)
        refund = (budget_atto - winning_price_atto) * occurrences if budget_atto > winning_price_atto else u256(0)
        if refund > 0:
            _Recipient(Address(requester)).emit_transfer(value=refund)

        deadline = now + int(self.series_duration[sid])
        addr = self._deploy_child_task(
            requester, self.series_title[sid], self.series_description[sid], self.series_criteria[sid],
            self.series_capability[sid], best_price, deadline, best_agent, best_price,
        )
        self.escrow[addr] = winning_price_atto
        self.escrow_released[addr] = False
        self.series_task[addr] = sid
        self.series_awarded[sid] = True
        self.series_committed_agent[sid] = best_agent
        self.series_committed_price[sid] = u256(best_price)
        self.series_next_advance_at[sid] = u256(now + int(self.series_interval[sid]))

        registry.emit(on="accepted").record_task_start(best_agent)
        return str(addr)

    @gl.public.write
    def advance_recurring_series(self, old_task_address: str) -> None:
        old_addr = Address(old_task_address)
        series_id = self.series_task.get(old_addr, u256(0))
        assert series_id != 0, "Task is not part of a recurring series"
        assert self.series_active.get(series_id, False), "Series is no longer active"
        assert self.series_awarded.get(series_id, False), "Series has not been awarded yet"
        assert self.series_remaining.get(series_id, u256(0)) > 1, "This was the last funded occurrence"
        assert self.escrow_released.get(old_addr, False), "Release the current occurrence's escrow first"

        now = int(datetime.now(timezone.utc).timestamp())
        assert now >= int(self.series_next_advance_at[series_id]), "Too early for the next occurrence"

        other = gl.get_contract_at(old_addr)
        old_status = other.view().get_task_state()["status"]
        assert old_status in ("verified", "rejected", "cancelled", "expired"), \
            "Current occurrence has not reached a terminal state"

        requester = self.series_requester[series_id]
        duration = int(self.series_duration[series_id])
        committed_agent = self.series_committed_agent[series_id]
        committed_price = self.series_committed_price[series_id]
        committed_price_atto = committed_price * u256(10**18)
        new_deadline = now + duration

        new_addr = self._deploy_child_task(
            requester,
            self.series_title[series_id],
            self.series_description[series_id],
            self.series_criteria[series_id],
            self.series_capability[series_id],
            int(committed_price),
            new_deadline,
            committed_agent,
            int(committed_price),
        )
        self.escrow[new_addr] = committed_price_atto
        self.escrow_released[new_addr] = False
        self.series_task[new_addr] = series_id

        registry = gl.get_contract_at(Address(self.registry))
        registry.emit(on="accepted").record_task_start(committed_agent)

        remaining = self.series_remaining[series_id] - 1
        self.series_remaining[series_id] = remaining
        self.series_next_advance_at[series_id] = u256(now + int(self.series_interval[series_id]))
        if remaining <= 1:
            self.series_active[series_id] = False

    @gl.public.write
    def cancel_recurring_series(self, series_id: int) -> None:
        sid = u256(series_id)
        caller = str(gl.message.sender_address)
        assert self.series_requester.get(sid, "") == caller, "Only the series requester can cancel"
        assert self.series_active.get(sid, False), "Series is already inactive"

        remaining = self.series_remaining.get(sid, u256(0))
        self.series_active[sid] = False

        if not self.series_awarded.get(sid, False):
            total_pool = self.series_budget[sid] * remaining
            if total_pool > 0:
                _Recipient(Address(caller)).emit_transfer(value=total_pool)
            self.series_remaining[sid] = u256(0)
        else:
            if remaining > 1:
                committed_price_atto = self.series_committed_price[sid] * u256(10**18)
                refund = committed_price_atto * (remaining - u256(1))
                if refund > 0:
                    _Recipient(Address(caller)).emit_transfer(value=refund)
            self.series_remaining[sid] = u256(1) if remaining > 0 else u256(0)

    @gl.public.view
    def get_all_tasks(self) -> list[str]:
        return [str(a) for a in self.tasks]

    @gl.public.view
    def get_task_count(self) -> int:
        return int(self.task_count)

    @gl.public.view
    def get_escrow_status(self, task_address: str) -> dict:
        addr = Address(task_address)
        return {
            "locked_amount": self.escrow.get(addr, u256(0)),
            "released": self.escrow_released.get(addr, False),
        }

    @gl.public.view
    def is_valid_task(self, task_address: str) -> bool:
        return Address(task_address) in self.escrow

    @gl.public.view
    def get_series(self, series_id: int) -> dict:
        sid = u256(series_id)
        return {
            "requester": self.series_requester.get(sid, ""),
            "title": self.series_title.get(sid, ""),
            "capability_required": self.series_capability.get(sid, ""),
            "budget_per_occurrence": self.series_budget.get(sid, u256(0)),
            "duration_seconds": self.series_duration.get(sid, u256(0)),
            "interval_seconds": self.series_interval.get(sid, u256(0)),
            "remaining": self.series_remaining.get(sid, u256(0)),
            "next_advance_at": self.series_next_advance_at.get(sid, u256(0)),
            "active": self.series_active.get(sid, False),
            "awarded": self.series_awarded.get(sid, False),
            "bidding_deadline": self.series_bidding_deadline.get(sid, u256(0)),
            "bid_count": len(json.loads(self.series_bids_json.get(sid, "")) if self.series_bids_json.get(sid, "") else []),
            "committed_agent": self.series_committed_agent.get(sid, ""),
            "committed_price": self.series_committed_price.get(sid, u256(0)),
        }

    @gl.public.view
    def get_series_bids(self, series_id: int) -> list[str]:
        sid = u256(series_id)
        raw = self.series_bids_json.get(sid, "")
        bids = json.loads(raw) if raw else []
        return [json.dumps(b) for b in bids]

    @gl.public.view
    def get_series_for_task(self, task_address: str) -> int:
        return int(self.series_task.get(Address(task_address), u256(0)))

    @gl.public.view
    def get_series_count(self) -> int:
        return int(self.next_series_id)
