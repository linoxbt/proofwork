# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# ProofWork AgentTaskFactory - deploys AgentTask child contracts and holds
# their GEN budget escrow. This is the contract deployed/hardcoded per
# network; AgentTask is never deployed directly.
#
# AGENT_TASK_CODE_B64 below is generated from agent_task.py - do not
# hand-edit it. Run `python3 contracts/generate_agent_factory.py` after
# changing agent_task.py to regenerate it.

from genlayer import *

from datetime import datetime, timezone
import base64

RELEASE_WINDOW_SECONDS = 86400  # 24h dispute window before escrow auto-releases
STAKE_SLASH_BPS = 1000  # 10.00%, in basis points of the agent's current stake

AGENT_TASK_CODE_B64 = "IyB7ICJEZXBlbmRzIjogInB5LWdlbmxheWVyOjFqYjQ1YWE4eW5oMmE5Yzl4bjNiN3FxaDhzbTVxOTNod2ZwN2pxbXdzZmhoOGpwejA5aDYiIH0KCiMgUHJvb2ZXb3JrIEFnZW50VGFzayAtIGEgc2luZ2xlIHVuaXQgb2YgYXV0b25vbW91cy1hZ2VudCB3b3JrOiBvcGVuIGZvcgojIGJpZGRpbmcsIGFzc2lnbmVkIHRvIHRoZSB3aW5uaW5nIGFnZW50LCB3b3JrZWQsIEFJLXZlcmlmaWVkLCBhbmQgc2V0dGxlZC4KIyBEZXBsb3llZCBhcyBhIGNoaWxkIG9mIEFnZW50VGFza0ZhY3RvcnkgKHNlZSBhZ2VudF90YXNrX2ZhY3RvcnkucHkpIC0gbm90CiMgZGVwbG95ZWQgZGlyZWN0bHkuCgpmcm9tIGdlbmxheWVyIGltcG9ydCAqCgpmcm9tIGRhdGV0aW1lIGltcG9ydCBkYXRldGltZSwgdGltZXpvbmUKaW1wb3J0IGhhc2hsaWIKaW1wb3J0IGpzb24KCkVSUk9SX0VYUEVDVEVEID0gIltFWFBFQ1RFRF0iCkVSUk9SX0VYVEVSTkFMID0gIltFWFRFUk5BTF0iCkVSUk9SX1RSQU5TSUVOVCA9ICJbVFJBTlNJRU5UXSIKRVJST1JfTExNID0gIltMTE1fRVJST1JdIgoKQklERElOR19XSU5ET1dfU0VDT05EUyA9IDEyMCAgIyBzaG9ydCBhdWN0aW9uIHdpbmRvdywgYWdlbnRzIGJpZCBhdXRvbm9tb3VzbHkKUkVQVVRBVElPTl9GTE9PUiA9IDcwICAjIG1pbmltdW0gcmVwdXRhdGlvbiByZXF1aXJlZCB0byBwbGFjZSBhIGJpZApQQVNTX1NDT1JFID0gNzAgICMgQUkgc2NvcmUgKDAtMTAwKSByZXF1aXJlZCB0byBwYXNzIHZlcmlmaWNhdGlvbgpNQVhfRElTUFVURVMgPSAzCgoKZGVmIF9jYXBhYmlsaXR5X21hdGNoZXMoYWdlbnRfY2FwYWJpbGl0aWVzOiBzdHIsIHJlcXVpcmVkOiBzdHIpIC0+IGJvb2w6CiAgICBpZiBub3QgcmVxdWlyZWQuc3RyaXAoKToKICAgICAgICByZXR1cm4gVHJ1ZQogICAgcmV0dXJuIHJlcXVpcmVkLnN0cmlwKCkubG93ZXIoKSBpbiBhZ2VudF9jYXBhYmlsaXRpZXMubG93ZXIoKQoKCmNsYXNzIEFnZW50VGFzayhnbC5Db250cmFjdCk6CiAgICByZXF1ZXN0ZXI6IHN0cgogICAgZmFjdG9yeTogc3RyCiAgICByZWdpc3RyeTogc3RyCiAgICB0aXRsZTogc3RyCiAgICBkZXNjcmlwdGlvbjogc3RyCiAgICBjcml0ZXJpYTogc3RyCiAgICBjYXBhYmlsaXR5X3JlcXVpcmVkOiBzdHIKICAgIGJ1ZGdldDogdTI1NgogICAgZGVhZGxpbmU6IHUyNTYKICAgIGJpZGRpbmdfZGVhZGxpbmU6IHUyNTYKICAgIGJpZHM6IER5bkFycmF5W3N0cl0gICMgSlNPTjogeyJhZ2VudCI6IHN0ciwgInByaWNlIjogaW50LCAiZXRhX2hvdXJzIjogaW50fQogICAgYXNzaWduZWRfYWdlbnQ6IHN0cgogICAgc3VibWlzc2lvbl91cmw6IHN0cgogICAgc3VibWlzc2lvbl9ub3RlOiBzdHIKICAgIHN1Ym1pc3Npb25fc25hcHNob3Q6IHN0cgogICAgc3RhdHVzOiBzdHIgICMgIm9wZW4iLCAiYXNzaWduZWQiLCAic3VibWl0dGVkIiwgInZlcmlmaWVkIiwgInJlamVjdGVkIiwKICAgICAgICAgICAgICAgICAjICJkaXNwdXRlZCIsICJjYW5jZWxsZWQiLCAiZXhwaXJlZCIKICAgIHZlcmlmaWNhdGlvbl9yZXN1bHQ6IHN0cgogICAgZGlzcHV0ZV9jb3VudDogdTI1NgogICAgZGlzcHV0ZV9yZWFzb246IHN0cgogICAgY3JlYXRlZF9hdDogdTI1NgogICAgdmVyaWZpZWRfYXQ6IHUyNTYKCiAgICBkZWYgX19pbml0X18oCiAgICAgICAgc2VsZiwKICAgICAgICByZXF1ZXN0ZXI6IHN0ciwKICAgICAgICBmYWN0b3J5OiBzdHIsCiAgICAgICAgcmVnaXN0cnk6IHN0ciwKICAgICAgICB0aXRsZTogc3RyLAogICAgICAgIGRlc2NyaXB0aW9uOiBzdHIsCiAgICAgICAgY3JpdGVyaWE6IHN0ciwKICAgICAgICBjYXBhYmlsaXR5X3JlcXVpcmVkOiBzdHIsCiAgICAgICAgYnVkZ2V0OiBpbnQsCiAgICAgICAgZGVhZGxpbmU6IGludCwKICAgICk6CiAgICAgICAgbm93ID0gaW50KGRhdGV0aW1lLm5vdyh0aW1lem9uZS51dGMpLnRpbWVzdGFtcCgpKQogICAgICAgIGFzc2VydCBkZWFkbGluZSA+IG5vdywgIkRlYWRsaW5lIG11c3QgYmUgaW4gdGhlIGZ1dHVyZSIKICAgICAgICBzZWxmLnJlcXVlc3RlciA9IHJlcXVlc3RlcgogICAgICAgIHNlbGYuZmFjdG9yeSA9IGZhY3RvcnkKICAgICAgICBzZWxmLnJlZ2lzdHJ5ID0gcmVnaXN0cnkKICAgICAgICBzZWxmLnRpdGxlID0gdGl0bGUKICAgICAgICBzZWxmLmRlc2NyaXB0aW9uID0gZGVzY3JpcHRpb24KICAgICAgICBzZWxmLmNyaXRlcmlhID0gY3JpdGVyaWEKICAgICAgICBzZWxmLmNhcGFiaWxpdHlfcmVxdWlyZWQgPSBjYXBhYmlsaXR5X3JlcXVpcmVkCiAgICAgICAgc2VsZi5idWRnZXQgPSBidWRnZXQKICAgICAgICBzZWxmLmRlYWRsaW5lID0gZGVhZGxpbmUKICAgICAgICBiaWRkaW5nX2Nsb3NlID0gbm93ICsgQklERElOR19XSU5ET1dfU0VDT05EUwogICAgICAgIHNlbGYuYmlkZGluZ19kZWFkbGluZSA9IGJpZGRpbmdfY2xvc2UgaWYgYmlkZGluZ19jbG9zZSA8IGRlYWRsaW5lIGVsc2UgZGVhZGxpbmUKICAgICAgICBzZWxmLmFzc2lnbmVkX2FnZW50ID0gIiIKICAgICAgICBzZWxmLnN1Ym1pc3Npb25fdXJsID0gIiIKICAgICAgICBzZWxmLnN1Ym1pc3Npb25fbm90ZSA9ICIiCiAgICAgICAgc2VsZi5zdWJtaXNzaW9uX3NuYXBzaG90ID0gIiIKICAgICAgICBzZWxmLnN0YXR1cyA9ICJvcGVuIgogICAgICAgIHNlbGYudmVyaWZpY2F0aW9uX3Jlc3VsdCA9ICIiCiAgICAgICAgc2VsZi5kaXNwdXRlX2NvdW50ID0gMAogICAgICAgIHNlbGYuZGlzcHV0ZV9yZWFzb24gPSAiIgogICAgICAgIHNlbGYuY3JlYXRlZF9hdCA9IG5vdwogICAgICAgIHNlbGYudmVyaWZpZWRfYXQgPSAwCgogICAgQGdsLnB1YmxpYy53cml0ZQogICAgZGVmIHBsYWNlX2JpZChzZWxmLCBwcmljZTogaW50LCBldGFfaG91cnM6IGludCkgLT4gTm9uZToKICAgICAgICBjYWxsZXIgPSBzdHIoZ2wubWVzc2FnZS5zZW5kZXJfYWRkcmVzcykKICAgICAgICBub3cgPSBpbnQoZGF0ZXRpbWUubm93KHRpbWV6b25lLnV0YykudGltZXN0YW1wKCkpCiAgICAgICAgYXNzZXJ0IHNlbGYuc3RhdHVzID09ICJvcGVuIiwgIkJpZGRpbmcgaXMgbm90IG9wZW4iCiAgICAgICAgYXNzZXJ0IG5vdyA8PSBzZWxmLmJpZGRpbmdfZGVhZGxpbmUsICJCaWRkaW5nIHdpbmRvdyBoYXMgY2xvc2VkIgogICAgICAgIGFzc2VydCBwcmljZSA+IDAsICJQcmljZSBtdXN0IGJlIHBvc2l0aXZlIgogICAgICAgIGFzc2VydCBldGFfaG91cnMgPiAwLCAiRVRBIG11c3QgYmUgcG9zaXRpdmUiCgogICAgICAgIHJlZ2lzdHJ5ID0gZ2wuZ2V0X2NvbnRyYWN0X2F0KEFkZHJlc3Moc2VsZi5yZWdpc3RyeSkpCiAgICAgICAgYWdlbnQgPSByZWdpc3RyeS52aWV3KCkuZ2V0X2FnZW50KGNhbGxlcikKICAgICAgICBhc3NlcnQgYWdlbnRbImFjdGl2ZSJdLCAiT25seSBhIHJlZ2lzdGVyZWQsIGFjdGl2ZSBhZ2VudCBjYW4gYmlkIgogICAgICAgIGFzc2VydCBpbnQoYWdlbnRbInJlcHV0YXRpb24iXSkgPj0gUkVQVVRBVElPTl9GTE9PUiwgIlJlcHV0YXRpb24gYmVsb3cgdGhlIGJpZGRpbmcgZmxvb3IiCiAgICAgICAgYXNzZXJ0IF9jYXBhYmlsaXR5X21hdGNoZXMoc3RyKGFnZW50WyJjYXBhYmlsaXRpZXMiXSksIHNlbGYuY2FwYWJpbGl0eV9yZXF1aXJlZCksIFwKICAgICAgICAgICAgIkFnZW50IGNhcGFiaWxpdGllcyBkbyBub3QgbWF0Y2ggdGhpcyB0YXNrIgoKICAgICAgICBmb3IgcmF3IGluIHNlbGYuYmlkczoKICAgICAgICAgICAgZXhpc3RpbmcgPSBqc29uLmxvYWRzKHJhdykKICAgICAgICAgICAgYXNzZXJ0IGV4aXN0aW5nWyJhZ2VudCJdICE9IGNhbGxlciwgIkFscmVhZHkgcGxhY2VkIGEgYmlkIG9uIHRoaXMgdGFzayIKCiAgICAgICAgc2VsZi5iaWRzLmFwcGVuZChqc29uLmR1bXBzKHsiYWdlbnQiOiBjYWxsZXIsICJwcmljZSI6IHByaWNlLCAiZXRhX2hvdXJzIjogZXRhX2hvdXJzfSkpCgogICAgQGdsLnB1YmxpYy53cml0ZQogICAgZGVmIGNsb3NlX2JpZGRpbmdfYW5kX2Fzc2lnbihzZWxmKSAtPiBOb25lOgogICAgICAgIG5vdyA9IGludChkYXRldGltZS5ub3codGltZXpvbmUudXRjKS50aW1lc3RhbXAoKSkKICAgICAgICBhc3NlcnQgc2VsZi5zdGF0dXMgPT0gIm9wZW4iLCAiQmlkZGluZyBpcyBub3Qgb3BlbiIKICAgICAgICBhc3NlcnQgbm93ID4gc2VsZi5iaWRkaW5nX2RlYWRsaW5lLCAiQmlkZGluZyB3aW5kb3cgc3RpbGwgb3BlbiIKCiAgICAgICAgaWYgbGVuKHNlbGYuYmlkcykgPT0gMDoKICAgICAgICAgICAgc2VsZi5zdGF0dXMgPSAiZXhwaXJlZCIKICAgICAgICAgICAgcmV0dXJuCgogICAgICAgIHJlZ2lzdHJ5ID0gZ2wuZ2V0X2NvbnRyYWN0X2F0KEFkZHJlc3Moc2VsZi5yZWdpc3RyeSkpCiAgICAgICAgcGFyc2VkID0gW2pzb24ubG9hZHMocmF3KSBmb3IgcmF3IGluIHNlbGYuYmlkc10KICAgICAgICBwcmljZXMgPSBbaW50KGJbInByaWNlIl0pIGZvciBiIGluIHBhcnNlZF0KICAgICAgICBldGFzID0gW2ludChiWyJldGFfaG91cnMiXSkgZm9yIGIgaW4gcGFyc2VkXQogICAgICAgIG1pbl9wcmljZSwgbWF4X3ByaWNlID0gbWluKHByaWNlcyksIG1heChwcmljZXMpCiAgICAgICAgbWluX2V0YSwgbWF4X2V0YSA9IG1pbihldGFzKSwgbWF4KGV0YXMpCgogICAgICAgIGJlc3RfYWdlbnQgPSAiIgogICAgICAgIGJlc3Rfc2NvcmUgPSAtMS4wCiAgICAgICAgZm9yIGIgaW4gcGFyc2VkOgogICAgICAgICAgICBwcmljZV9zY29yZSA9IDEuMCBpZiBtYXhfcHJpY2UgPT0gbWluX3ByaWNlIGVsc2UgMS4wIC0gKGludChiWyJwcmljZSJdKSAtIG1pbl9wcmljZSkgLyAobWF4X3ByaWNlIC0gbWluX3ByaWNlKQogICAgICAgICAgICBzcGVlZF9zY29yZSA9IDEuMCBpZiBtYXhfZXRhID09IG1pbl9ldGEgZWxzZSAxLjAgLSAoaW50KGJbImV0YV9ob3VycyJdKSAtIG1pbl9ldGEpIC8gKG1heF9ldGEgLSBtaW5fZXRhKQogICAgICAgICAgICBhZ2VudF9pbmZvID0gcmVnaXN0cnkudmlldygpLmdldF9hZ2VudChiWyJhZ2VudCJdKQogICAgICAgICAgICByZXBfc2NvcmUgPSBtaW4oaW50KGFnZW50X2luZm9bInJlcHV0YXRpb24iXSksIDEwMDApIC8gMTAwMC4wCiAgICAgICAgICAgIHNlZWQgPSBmIntnbC5tZXNzYWdlLmNvbnRyYWN0X2FkZHJlc3N9OntiWydhZ2VudCddfSIuZW5jb2RlKCkKICAgICAgICAgICAgcmFuZG9tX2NvbXBvbmVudCA9IChpbnQoaGFzaGxpYi5zaGEyNTYoc2VlZCkuaGV4ZGlnZXN0KCksIDE2KSAlIDEwMDAwMCkgLyAxMDAwMDAuMAogICAgICAgICAgICBzY29yZSA9IHByaWNlX3Njb3JlICogMC4yNSArIHJlcF9zY29yZSAqIDAuMTAgKyBzcGVlZF9zY29yZSAqIDAuMTAgKyByYW5kb21fY29tcG9uZW50ICogMC41NQogICAgICAgICAgICBpZiBzY29yZSA+IGJlc3Rfc2NvcmU6CiAgICAgICAgICAgICAgICBiZXN0X3Njb3JlID0gc2NvcmUKICAgICAgICAgICAgICAgIGJlc3RfYWdlbnQgPSBiWyJhZ2VudCJdCgogICAgICAgIHNlbGYuYXNzaWduZWRfYWdlbnQgPSBiZXN0X2FnZW50CiAgICAgICAgc2VsZi5zdGF0dXMgPSAiYXNzaWduZWQiCiAgICAgICAgcmVnaXN0cnkuZW1pdChvbj0iYWNjZXB0ZWQiKS5yZWNvcmRfdGFza19zdGFydChiZXN0X2FnZW50KQoKICAgIEBnbC5wdWJsaWMud3JpdGUKICAgIGRlZiBzdWJtaXRfZGVsaXZlcmFibGUoc2VsZiwgZXZpZGVuY2VfdXJsOiBzdHIsIHN1Ym1pc3Npb25fbm90ZTogc3RyKSAtPiBOb25lOgogICAgICAgIGNhbGxlciA9IHN0cihnbC5tZXNzYWdlLnNlbmRlcl9hZGRyZXNzKQogICAgICAgIG5vdyA9IGludChkYXRldGltZS5ub3codGltZXpvbmUudXRjKS50aW1lc3RhbXAoKSkKICAgICAgICBhc3NlcnQgY2FsbGVyID09IHNlbGYuYXNzaWduZWRfYWdlbnQsICJPbmx5IHRoZSBhc3NpZ25lZCBhZ2VudCBjYW4gc3VibWl0IgogICAgICAgIGFzc2VydCBzZWxmLnN0YXR1cyA9PSAiYXNzaWduZWQiLCAiVGFzayBtdXN0IGJlIGFzc2lnbmVkIGZpcnN0IgogICAgICAgIGFzc2VydCBub3cgPD0gc2VsZi5kZWFkbGluZSwgIlRhc2sgZGVhZGxpbmUgaGFzIHBhc3NlZCIKCiAgICAgICAgdXJsX2xvd2VyID0gZXZpZGVuY2VfdXJsLmxvd2VyKCkuc3RyaXAoKQogICAgICAgIGFzc2VydCB1cmxfbG93ZXIuc3RhcnRzd2l0aCgiaHR0cDovLyIpIG9yIHVybF9sb3dlci5zdGFydHN3aXRoKCJodHRwczovLyIpLCBcCiAgICAgICAgICAgICJFdmlkZW5jZSBtdXN0IGJlIGEgdmFsaWQgVVJMIgoKICAgICAgICBkZWYgZmV0Y2hfZXZpZGVuY2UoKToKICAgICAgICAgICAgdHJ5OgogICAgICAgICAgICAgICAgcmV0dXJuIGdsLm5vbmRldC53ZWIucmVuZGVyKGV2aWRlbmNlX3VybCwgbW9kZT0idGV4dCIpWzo4MDAwXQogICAgICAgICAgICBleGNlcHQgRXhjZXB0aW9uIGFzIGU6CiAgICAgICAgICAgICAgICByYWlzZSBnbC52bS5Vc2VyRXJyb3IoZiJ7RVJST1JfVFJBTlNJRU5UfSBmYWlsZWQgdG8gZmV0Y2gge2V2aWRlbmNlX3VybH06IHtlfSIpCgogICAgICAgIGNvbW1pdHRlZF9jb250ZW50ID0gZ2wuZXFfcHJpbmNpcGxlLnByb21wdF9jb21wYXJhdGl2ZSgKICAgICAgICAgICAgZmV0Y2hfZXZpZGVuY2UsCiAgICAgICAgICAgIHByaW5jaXBsZT0oCiAgICAgICAgICAgICAgICAiQm90aCBmZXRjaGVzIG11c3QgYmUgb2YgdGhlIHNhbWUgdW5kZXJseWluZyBwYWdlIG9yIHJlc291cmNlLiBNaW5vciAiCiAgICAgICAgICAgICAgICAiZm9ybWF0dGluZyBvciBpbmNpZGVudGFsIGR5bmFtaWMgZWxlbWVudHMgKHRpbWVzdGFtcHMsIGNvdW50ZXJzKSBtYXkgIgogICAgICAgICAgICAgICAgImRpZmZlciwgYnV0IHRoZSBzdWJzdGFudGl2ZSBjb250ZW50IG11c3QgbWF0Y2guIgogICAgICAgICAgICApLAogICAgICAgICkKCiAgICAgICAgc2VsZi5zdWJtaXNzaW9uX3VybCA9IGV2aWRlbmNlX3VybAogICAgICAgIHNlbGYuc3VibWlzc2lvbl9ub3RlID0gc3VibWlzc2lvbl9ub3RlCiAgICAgICAgc2VsZi5zdWJtaXNzaW9uX3NuYXBzaG90ID0gY29tbWl0dGVkX2NvbnRlbnQKICAgICAgICBzZWxmLnN0YXR1cyA9ICJzdWJtaXR0ZWQiCgogICAgQGdsLnB1YmxpYy53cml0ZQogICAgZGVmIGNoZWNrX3RpbWVvdXQoc2VsZikgLT4gTm9uZToKICAgICAgICBub3cgPSBpbnQoZGF0ZXRpbWUubm93KHRpbWV6b25lLnV0YykudGltZXN0YW1wKCkpCiAgICAgICAgYXNzZXJ0IHNlbGYuc3RhdHVzID09ICJhc3NpZ25lZCIsICJUYXNrIGlzIG5vdCBhd2FpdGluZyBhIHN1Ym1pc3Npb24iCiAgICAgICAgYXNzZXJ0IG5vdyA+IHNlbGYuZGVhZGxpbmUsICJEZWFkbGluZSBoYXMgbm90IHBhc3NlZCB5ZXQiCiAgICAgICAgc2VsZi52ZXJpZmljYXRpb25fcmVzdWx0ID0ganNvbi5kdW1wcyh7CiAgICAgICAgICAgICJ2ZXJpZmllZCI6IEZhbHNlLAogICAgICAgICAgICAiY29uZmlkZW5jZSI6IDEwMCwKICAgICAgICAgICAgInJlYXNvbmluZyI6ICJUaGUgYXNzaWduZWQgYWdlbnQgbWlzc2VkIHRoZSBzdWJtaXNzaW9uIGRlYWRsaW5lLiIsCiAgICAgICAgfSkKICAgICAgICBzZWxmLnN0YXR1cyA9ICJyZWplY3RlZCIKICAgICAgICBzZWxmLnZlcmlmaWVkX2F0ID0gbm93CgogICAgQGdsLnB1YmxpYy53cml0ZQogICAgZGVmIHJlcXVlc3RfdmVyaWZpY2F0aW9uKHNlbGYpIC0+IE5vbmU6CiAgICAgICAgY2FsbGVyID0gc3RyKGdsLm1lc3NhZ2Uuc2VuZGVyX2FkZHJlc3MpCiAgICAgICAgYXNzZXJ0IGNhbGxlciBpbiAoc2VsZi5yZXF1ZXN0ZXIsIHNlbGYuYXNzaWduZWRfYWdlbnQpLCBcCiAgICAgICAgICAgICJPbmx5IHRoZSByZXF1ZXN0ZXIgb3IgYXNzaWduZWQgYWdlbnQgY2FuIHJlcXVlc3QgdmVyaWZpY2F0aW9uIgogICAgICAgIGFzc2VydCBzZWxmLnN0YXR1cyBpbiAoInN1Ym1pdHRlZCIsICJkaXNwdXRlZCIpLCAiVGFzayBtdXN0IGJlIHN1Ym1pdHRlZCBvciBkaXNwdXRlZCB0byB2ZXJpZnkiCiAgICAgICAgc2VsZi5fdmVyaWZ5X3N1Ym1pc3Npb24oKQoKICAgIEBnbC5wdWJsaWMud3JpdGUKICAgIGRlZiBkaXNwdXRlKHNlbGYsIHJlYXNvbjogc3RyKSAtPiBOb25lOgogICAgICAgIGNhbGxlciA9IHN0cihnbC5tZXNzYWdlLnNlbmRlcl9hZGRyZXNzKQogICAgICAgIGFzc2VydCBjYWxsZXIgaW4gKHNlbGYucmVxdWVzdGVyLCBzZWxmLmFzc2lnbmVkX2FnZW50KSwgIk9ubHkgdGhlIHJlcXVlc3RlciBvciBhZ2VudCBjYW4gZGlzcHV0ZSIKICAgICAgICBhc3NlcnQgc2VsZi5zdGF0dXMgaW4gKCJ2ZXJpZmllZCIsICJyZWplY3RlZCIpLCAiQ2FuIG9ubHkgZGlzcHV0ZSBhIGRlY2lkZWQgdmVyaWZpY2F0aW9uIgogICAgICAgIGFzc2VydCBzZWxmLmRpc3B1dGVfY291bnQgPCBNQVhfRElTUFVURVMsICJNYXhpbXVtIGRpc3B1dGVzIHJlYWNoZWQgLSBkZWNpc2lvbiBpcyBmaW5hbCIKICAgICAgICBzZWxmLmRpc3B1dGVfY291bnQgKz0gMQogICAgICAgIHNlbGYuZGlzcHV0ZV9yZWFzb24gPSByZWFzb24KICAgICAgICBzZWxmLnN0YXR1cyA9ICJkaXNwdXRlZCIKICAgICAgICBzZWxmLnZlcmlmaWVkX2F0ID0gMAoKICAgIEBnbC5wdWJsaWMud3JpdGUKICAgIGRlZiBjYW5jZWxfdGFzayhzZWxmKSAtPiBOb25lOgogICAgICAgIGNhbGxlciA9IHN0cihnbC5tZXNzYWdlLnNlbmRlcl9hZGRyZXNzKQogICAgICAgIGFzc2VydCBjYWxsZXIgPT0gc2VsZi5yZXF1ZXN0ZXIsICJPbmx5IHRoZSByZXF1ZXN0ZXIgY2FuIGNhbmNlbCIKICAgICAgICBhc3NlcnQgc2VsZi5zdGF0dXMgPT0gIm9wZW4iLCAiQ2FuIG9ubHkgY2FuY2VsIGJlZm9yZSBiaWRkaW5nIGNsb3NlcyIKICAgICAgICBzZWxmLnN0YXR1cyA9ICJjYW5jZWxsZWQiCgogICAgQGdsLnB1YmxpYy52aWV3CiAgICBkZWYgZ2V0X3Rhc2tfc3RhdGUoc2VsZikgLT4gZGljdDoKICAgICAgICByZXR1cm4gewogICAgICAgICAgICAicmVxdWVzdGVyIjogc2VsZi5yZXF1ZXN0ZXIsCiAgICAgICAgICAgICJmYWN0b3J5Ijogc2VsZi5mYWN0b3J5LAogICAgICAgICAgICAicmVnaXN0cnkiOiBzZWxmLnJlZ2lzdHJ5LAogICAgICAgICAgICAidGl0bGUiOiBzZWxmLnRpdGxlLAogICAgICAgICAgICAiZGVzY3JpcHRpb24iOiBzZWxmLmRlc2NyaXB0aW9uLAogICAgICAgICAgICAiY3JpdGVyaWEiOiBzZWxmLmNyaXRlcmlhLAogICAgICAgICAgICAiY2FwYWJpbGl0eV9yZXF1aXJlZCI6IHNlbGYuY2FwYWJpbGl0eV9yZXF1aXJlZCwKICAgICAgICAgICAgImJ1ZGdldCI6IHNlbGYuYnVkZ2V0LAogICAgICAgICAgICAiZGVhZGxpbmUiOiBzZWxmLmRlYWRsaW5lLAogICAgICAgICAgICAiYmlkZGluZ19kZWFkbGluZSI6IHNlbGYuYmlkZGluZ19kZWFkbGluZSwKICAgICAgICAgICAgImJpZF9jb3VudCI6IGxlbihzZWxmLmJpZHMpLAogICAgICAgICAgICAiYXNzaWduZWRfYWdlbnQiOiBzZWxmLmFzc2lnbmVkX2FnZW50LAogICAgICAgICAgICAic3VibWlzc2lvbl91cmwiOiBzZWxmLnN1Ym1pc3Npb25fdXJsLAogICAgICAgICAgICAic3VibWlzc2lvbl9ub3RlIjogc2VsZi5zdWJtaXNzaW9uX25vdGUsCiAgICAgICAgICAgICJzdGF0dXMiOiBzZWxmLnN0YXR1cywKICAgICAgICAgICAgInZlcmlmaWNhdGlvbl9yZXN1bHQiOiBzZWxmLnZlcmlmaWNhdGlvbl9yZXN1bHQsCiAgICAgICAgICAgICJkaXNwdXRlX2NvdW50Ijogc2VsZi5kaXNwdXRlX2NvdW50LAogICAgICAgICAgICAiZGlzcHV0ZV9yZWFzb24iOiBzZWxmLmRpc3B1dGVfcmVhc29uLAogICAgICAgICAgICAiY3JlYXRlZF9hdCI6IHNlbGYuY3JlYXRlZF9hdCwKICAgICAgICAgICAgInZlcmlmaWVkX2F0Ijogc2VsZi52ZXJpZmllZF9hdCwKICAgICAgICB9CgogICAgQGdsLnB1YmxpYy52aWV3CiAgICBkZWYgZ2V0X2JpZHMoc2VsZikgLT4gbGlzdFtzdHJdOgogICAgICAgIHJldHVybiBbYiBmb3IgYiBpbiBzZWxmLmJpZHNdCgogICAgZGVmIF92ZXJpZnlfc3VibWlzc2lvbihzZWxmKToKICAgICAgICB0aXRsZSA9IHNlbGYudGl0bGUKICAgICAgICBkZXNjcmlwdGlvbiA9IHNlbGYuZGVzY3JpcHRpb24KICAgICAgICBjcml0ZXJpYSA9IHNlbGYuY3JpdGVyaWEKICAgICAgICBzdWJtaXNzaW9uX25vdGUgPSBzZWxmLnN1Ym1pc3Npb25fbm90ZQogICAgICAgIGRpc3B1dGVfcmVhc29uID0gc2VsZi5kaXNwdXRlX3JlYXNvbgogICAgICAgIGlzX3JlZGlzcHV0ZSA9IHNlbGYuZGlzcHV0ZV9jb3VudCA+IDAKICAgICAgICB3ZWJfZGF0YSA9IHNlbGYuc3VibWlzc2lvbl9zbmFwc2hvdAoKICAgICAgICBkZWYgYW5hbHl6ZSgpOgogICAgICAgICAgICBkaXNwdXRlX2NvbnRleHQgPSAiIgogICAgICAgICAgICBpZiBpc19yZWRpc3B1dGUgYW5kIGRpc3B1dGVfcmVhc29uOgogICAgICAgICAgICAgICAgZGlzcHV0ZV9jb250ZXh0ID0gZiIiIgpUaGlzIHN1Ym1pc3Npb24gd2FzIERJU1BVVEVEIGJ5IHRoZSByZXF1ZXN0ZXIgb3IgdGhlIGFnZW50LiBSZS1leGFtaW5lIHRoZSBldmlkZW5jZQpjYXJlZnVsbHkgaW4gbGlnaHQgb2YgdGhlIGRpc3B1dGUgcmVhc29uIGJlbG93LCBhbmQgZG8gbm90IHNpbXBseSByZXBlYXQgYSBwcmlvcgp2ZXJkaWN0IC0gZm9ybSB5b3VyIG93biBpbmRlcGVuZGVudCBqdWRnbWVudCBmcm9tIHRoZSBjdXJyZW50IGV2aWRlbmNlLgoKRElTUFVURSBSRUFTT046IHtkaXNwdXRlX3JlYXNvbn0KIiIiCiAgICAgICAgICAgIG5vdGVfY29udGV4dCA9IGYiXG5BR0VOVCdTIE5PVEU6IHtzdWJtaXNzaW9uX25vdGV9XG4iIGlmIHN1Ym1pc3Npb25fbm90ZSBlbHNlICIiCgogICAgICAgICAgICBwcm9tcHQgPSBmIiIiWW91IGFyZSBhbiBBSSByZXZpZXdlciBzY29yaW5nIGFuIGF1dG9ub21vdXMgYWdlbnQncyBjb21wbGV0ZWQgd29yay4KClRBU0sgVElUTEU6IHt0aXRsZX0KVEFTSyBERVNDUklQVElPTjoge2Rlc2NyaXB0aW9ufQpDT01QTEVUSU9OIENSSVRFUklBIChSVUJSSUMpOiB7Y3JpdGVyaWF9CgpTVUJNSVRURUQgREVMSVZFUkFCTEU6Cntub3RlX2NvbnRleHR9e2Rpc3B1dGVfY29udGV4dH0KREVMSVZFUkFCTEUgQ09OVEVOVDoKe3dlYl9kYXRhWzo4MDAwXX0KClNjb3JlIHRoZSBkZWxpdmVyYWJsZSBhZ2FpbnN0IHRoZSBydWJyaWMgb24gYSAwLTEwMCBzY2FsZS4gQSBzY29yZSBvZiB7UEFTU19TQ09SRX0gb3IKYWJvdmUgbWVhbnMgdGhlIHdvcmsgcGFzc2VzIGFuZCB0aGUgYWdlbnQgZ2V0cyBwYWlkOyBiZWxvdyB0aGF0LCBpdCBmYWlscyBhbmQgdGhlCmFnZW50IGlzIHBlbmFsaXplZC4KClJlc3BvbmQgaW4gdmFsaWQgSlNPTiBmb3JtYXQ6Cnt7InNjb3JlIjogMC0xMDAsICJyZWFzb25pbmciOiAiZGV0YWlsZWQgZXhwbGFuYXRpb24gb2YgeW91ciBzY29yaW5nIn19CgpCZSBzdHJpY3QgYnV0IGZhaXIuIiIiCgogICAgICAgICAgICByZXN1bHQgPSBnbC5ub25kZXQuZXhlY19wcm9tcHQocHJvbXB0LCByZXNwb25zZV9mb3JtYXQ9Impzb24iKQoKICAgICAgICAgICAgaWYgbm90IGlzaW5zdGFuY2UocmVzdWx0LCBkaWN0KSBvciAic2NvcmUiIG5vdCBpbiByZXN1bHQ6CiAgICAgICAgICAgICAgICByZXR1cm4geyJzY29yZSI6IDAsICJyZWFzb25pbmciOiAiQUkgc2NvcmluZyBwcm9kdWNlZCBtYWxmb3JtZWQgb3V0cHV0LiBNYW51YWwgcmV2aWV3IG5lZWRlZC4ifQoKICAgICAgICAgICAgdHJ5OgogICAgICAgICAgICAgICAgc2NvcmUgPSBtYXgoMCwgbWluKDEwMCwgaW50KHJvdW5kKGZsb2F0KHJlc3VsdC5nZXQoInNjb3JlIiwgMCkgb3IgMCkpKSkpCiAgICAgICAgICAgIGV4Y2VwdCAoVmFsdWVFcnJvciwgVHlwZUVycm9yKToKICAgICAgICAgICAgICAgIHNjb3JlID0gMAoKICAgICAgICAgICAgcmV0dXJuIHsic2NvcmUiOiBzY29yZSwgInJlYXNvbmluZyI6IHN0cihyZXN1bHQuZ2V0KCJyZWFzb25pbmciLCAiIikpfQoKICAgICAgICBwYXJzZWQgPSBnbC5lcV9wcmluY2lwbGUucHJvbXB0X2NvbXBhcmF0aXZlKAogICAgICAgICAgICBhbmFseXplLAogICAgICAgICAgICBwcmluY2lwbGU9KAogICAgICAgICAgICAgICAgImBzY29yZWAgc2hvdWxkIGJlIHdpdGhpbiAxNSBwb2ludHMgb2YgZWFjaCBvdGhlciBhbmQgb24gdGhlIHNhbWUgc2lkZSAiCiAgICAgICAgICAgICAgICAib2YgdGhlIHBhc3MvZmFpbCBsaW5lLiBgcmVhc29uaW5nYCBtYXkgZGlmZmVyIGluIHdvcmRpbmcgYnV0IHNob3VsZCAiCiAgICAgICAgICAgICAgICAicmVmZXJlbmNlIHNpbWlsYXIgZXZpZGVuY2UuIgogICAgICAgICAgICApLAogICAgICAgICkKCiAgICAgICAgbm93ID0gaW50KGRhdGV0aW1lLm5vdyh0aW1lem9uZS51dGMpLnRpbWVzdGFtcCgpKQogICAgICAgIHNjb3JlID0gaW50KHBhcnNlZC5nZXQoInNjb3JlIiwgMCkpCiAgICAgICAgcGFzc2VkID0gc2NvcmUgPj0gUEFTU19TQ09SRQogICAgICAgIHNlbGYudmVyaWZpY2F0aW9uX3Jlc3VsdCA9IGpzb24uZHVtcHMoewogICAgICAgICAgICAidmVyaWZpZWQiOiBwYXNzZWQsCiAgICAgICAgICAgICJjb25maWRlbmNlIjogc2NvcmUsCiAgICAgICAgICAgICJyZWFzb25pbmciOiBwYXJzZWQuZ2V0KCJyZWFzb25pbmciLCAiIiksCiAgICAgICAgfSkKICAgICAgICBzZWxmLnN0YXR1cyA9ICJ2ZXJpZmllZCIgaWYgcGFzc2VkIGVsc2UgInJlamVjdGVkIgogICAgICAgIHNlbGYudmVyaWZpZWRfYXQgPSBub3cK"


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

    # Recurring series: a requester pre-funds N occurrences up front in one
    # payable call; each occurrence after the first is deployed from that
    # pre-funded pool (no new transfer needed) once the prior one settles and
    # the interval has elapsed.
    next_series_id: u256
    series_task: TreeMap[Address, u256]  # deployed task address -> series id (0 = not part of a series)
    series_requester: TreeMap[u256, str]
    series_title: TreeMap[u256, str]
    series_description: TreeMap[u256, str]
    series_criteria: TreeMap[u256, str]
    series_capability: TreeMap[u256, str]
    series_budget: TreeMap[u256, u256]  # per occurrence, atto-GEN
    series_duration: TreeMap[u256, u256]  # deadline_duration_seconds per occurrence
    series_interval: TreeMap[u256, u256]  # min gap before the next occurrence can be posted
    series_remaining: TreeMap[u256, u256]  # occurrences left, including the current one
    series_next_advance_at: TreeMap[u256, u256]
    series_active: TreeMap[u256, bool]

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
    ) -> str:
        assert occurrences >= 1, "Must fund at least 1 occurrence"
        assert deadline_duration_seconds > 0, "Duration must be positive"
        assert interval_seconds >= 0, "Interval cannot be negative"
        expected_value = u256(budget_per_occurrence) * u256(occurrences) * u256(10**18)
        assert gl.message.value == expected_value, \
            "Sent value must equal budget_per_occurrence * occurrences GEN (in atto-GEN)"

        requester = str(gl.message.sender_address)
        now = int(datetime.now(timezone.utc).timestamp())
        deadline = now + deadline_duration_seconds

        addr = self._deploy_child_task(
            requester, title, description, criteria, capability_required, budget_per_occurrence, deadline
        )
        self.escrow[addr] = u256(budget_per_occurrence) * u256(10**18)
        self.escrow_released[addr] = False

        self.next_series_id += 1
        series_id = self.next_series_id
        self.series_task[addr] = series_id
        self.series_requester[series_id] = requester
        self.series_title[series_id] = title
        self.series_description[series_id] = description
        self.series_criteria[series_id] = criteria
        self.series_capability[series_id] = capability_required
        self.series_budget[series_id] = u256(budget_per_occurrence) * u256(10**18)
        self.series_duration[series_id] = u256(deadline_duration_seconds)
        self.series_interval[series_id] = u256(interval_seconds)
        self.series_remaining[series_id] = u256(occurrences)
        self.series_next_advance_at[series_id] = u256(now + interval_seconds)
        self.series_active[series_id] = True
        return str(addr)

    @gl.public.write
    def advance_recurring_series(self, old_task_address: str) -> None:
        old_addr = Address(old_task_address)
        series_id = self.series_task.get(old_addr, u256(0))
        assert series_id != 0, "Task is not part of a recurring series"
        assert self.series_active.get(series_id, False), "Series is no longer active"
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
        budget_atto = self.series_budget[series_id]
        new_deadline = now + duration

        new_addr = self._deploy_child_task(
            requester,
            self.series_title[series_id],
            self.series_description[series_id],
            self.series_criteria[series_id],
            self.series_capability[series_id],
            int(budget_atto // u256(10**18)),
            new_deadline,
        )
        self.escrow[new_addr] = budget_atto
        self.escrow_released[new_addr] = False
        self.series_task[new_addr] = series_id

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
        # Refund every occurrence that hasn't been deployed yet - the current
        # (already-deployed) occurrence's own escrow is untouched and settles
        # normally through release_funds.
        if remaining > 1:
            refund = self.series_budget[sid] * (remaining - u256(1))
            if refund > 0:
                _Recipient(Address(caller)).emit_transfer(value=refund)
        self.series_remaining[sid] = u256(1) if remaining > 0 else u256(0)

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
        }

    @gl.public.view
    def get_series_for_task(self, task_address: str) -> int:
        return int(self.series_task.get(Address(task_address), u256(0)))

    @gl.public.view
    def get_series_count(self) -> int:
        return int(self.next_series_id)

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

        if status in ("verified", "rejected"):
            verified_at = int(state["verified_at"])
            assert verified_at > 0, "No verification timestamp recorded"
            now = int(datetime.now(timezone.utc).timestamp())
            assert now >= verified_at + RELEASE_WINDOW_SECONDS, "24h dispute window still open"
            recipient = state["assigned_agent"] if status == "verified" else state["requester"]
        else:
            recipient = state["requester"]

        amount = self.escrow[addr]
        self.escrow_released[addr] = True
        _Recipient(Address(recipient)).emit_transfer(value=amount)

        if status in ("verified", "rejected") and state["assigned_agent"]:
            registry = gl.get_contract_at(Address(self.registry))
            passed = status == "verified"
            agent_info = registry.view().get_agent(state["assigned_agent"])
            current_stake = int(agent_info["stake"])

            if passed:
                new_stake = current_stake
            else:
                # Slash 10% of the agent's stake to the requester, on top of
                # their budget refund above - a second, separate transfer
                # from this same synchronous method (the proven pattern),
                # never from inside an emit()-invoked registry method.
                slash_amount = (current_stake * STAKE_SLASH_BPS) // 10000
                new_stake = current_stake - slash_amount
                if slash_amount > 0:
                    _Recipient(Address(state["requester"])).emit_transfer(value=slash_amount)

            registry.emit(on="accepted").record_task_outcome(
                state["assigned_agent"], passed, new_stake
            )

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
