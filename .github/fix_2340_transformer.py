from pathlib import Path
p=Path('.github/apply_2340.py')
s=p.read_text(encoding='utf-8')
s=s.replace("        action_markup = f'''\n", "        action_markup = f\"\"\"\n", 1)
s=s.replace("      </div>'''\n\n    nav_id", "      </div>\"\"\"\n\n    nav_id", 1)
s=s.replace("    return f'''{NAV_START}\n", "    return f\"\"\"{NAV_START}\n", 1)
s=s.replace("{NAV_END}'''\n'''\nfront,count", "{NAV_END}\"\"\"\n'''\nfront,count", 1)
p.write_text(s,encoding='utf-8')
