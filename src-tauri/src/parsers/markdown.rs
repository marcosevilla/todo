use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CheckboxItem {
    pub line_number: usize,
    pub checked: bool,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ParsedTodayMd {
    pub tasks: Vec<CheckboxItem>,
    pub habits_core: Vec<CheckboxItem>,
    pub habits_bonus: Vec<CheckboxItem>,
}

/// Parse today.md into structured sections.
/// Expected format:
///   # Today
///   - [ ] task 1
///   ---
///   ## Habits
///   - [ ] core habit (6 items before blank line or subheading)
///   - [ ] bonus habit (remaining items)
pub fn parse_today_md(content: &str) -> ParsedTodayMd {
    let lines: Vec<&str> = content.lines().collect();
    let mut tasks = Vec::new();
    let mut habits_core = Vec::new();
    let mut habits_bonus = Vec::new();

    // Track which section we're in
    let mut section = Section::Preamble;
    let mut in_bonus = false;

    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();

        // Detect section transitions
        if trimmed == "---" {
            if section == Section::Tasks {
                section = Section::AfterTasks;
            }
            continue;
        }
        if trimmed.starts_with("# Today") {
            section = Section::Tasks;
            continue;
        }
        if trimmed.starts_with("## Habits") {
            section = Section::Habits;
            in_bonus = false;
            continue;
        }

        // Skip frontmatter and non-checkbox lines
        if trimmed.starts_with("---") || trimmed.starts_with("*") || trimmed.is_empty() {
            // A blank line in habits section separates core from bonus
            if section == Section::Habits && trimmed.is_empty() && !habits_core.is_empty() {
                in_bonus = true;
            }
            continue;
        }

        // Detect <details> / <summary> markers for bonus habits
        if trimmed.contains("<details") || trimmed.contains("<summary") || trimmed.contains("</details>") || trimmed.contains("</summary>") {
            if trimmed.contains("Bonus") {
                in_bonus = true;
            }
            continue;
        }

        // Parse checkbox lines
        if let Some(item) = parse_checkbox_line(trimmed, i) {
            match section {
                Section::Tasks => tasks.push(item),
                Section::Habits => {
                    if in_bonus {
                        habits_bonus.push(item);
                    } else {
                        habits_core.push(item);
                    }
                }
                _ => {}
            }
        }
    }

    ParsedTodayMd {
        tasks,
        habits_core,
        habits_bonus,
    }
}

fn parse_checkbox_line(line: &str, line_number: usize) -> Option<CheckboxItem> {
    let trimmed = line.trim();
    if trimmed.starts_with("- [x]") || trimmed.starts_with("- [X]") {
        let text = trimmed[5..].trim().to_string();
        Some(CheckboxItem {
            line_number,
            checked: true,
            text,
        })
    } else if trimmed.starts_with("- [ ]") {
        let text = trimmed[5..].trim().to_string();
        Some(CheckboxItem {
            line_number,
            checked: false,
            text,
        })
    } else {
        None
    }
}

/// Toggle a checkbox at a specific line number in the file content.
/// Returns the modified content.
pub fn toggle_checkbox(content: &str, line_number: usize) -> String {
    let mut lines: Vec<String> = content.lines().map(String::from).collect();

    if line_number < lines.len() {
        let line = &lines[line_number];
        if line.contains("- [ ]") {
            lines[line_number] = line.replace("- [ ]", "- [x]");
        } else if line.contains("- [x]") || line.contains("- [X]") {
            lines[line_number] = line.replace("- [x]", "- [ ]").replace("- [X]", "- [ ]");
        }
    }

    lines.join("\n")
}

#[derive(Debug, PartialEq)]
enum Section {
    Preamble,
    Tasks,
    AfterTasks,
    Habits,
}
