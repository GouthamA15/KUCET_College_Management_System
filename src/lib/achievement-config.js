export const ACHIEVEMENT_TYPES = [
  "Certification",
  "Competition",
  "Hackathon",
  "Internship",
  "Workshop",
  "Seminar",
  "Publication",
  "Research",
  "Project",
  "Sports",
  "Cultural",
  "Leadership",
  "Volunteer",
  "Other"
];

export const ACHIEVEMENT_LEVELS = [
  "College",
  "University",
  "State",
  "National",
  "International",
  "Other"
];

export const ACHIEVEMENT_CONFIG = {
  Certification: {
    groups: {
      'Certification Details': [
        { name: 'title', label: 'Certification Name', required: true, span: 2 },
        { name: 'issuing_organization', label: 'Issuing Organization', required: true, span: 2 }
      ],
      'Dates': [
        { name: 'achievement_date', label: 'Issue / Completion Date', type: 'date', required: true, span: 2 }
      ],
      'Additional Details': [
        { name: 'credential_id', label: 'Credential ID', isAdditional: true },
        { name: 'credential_url', label: 'Credential URL', isAdditional: true }
      ]
    },
    descLabel: 'Description (optional)'
  },
  Internship: {
    groups: {
      'Internship Details': [
        { name: 'title', label: 'Internship Title / Role', required: true, span: 2 },
        { name: 'issuing_organization', label: 'Organization', required: true, span: 2 }
      ],
      'Duration': [
        { name: 'start_date', label: 'Start Date', type: 'date', required: true },
        { name: 'end_date', label: 'End Date', type: 'date', required: true }
      ],
      'Additional Details': [
        { name: 'mode', label: 'Mode', type: 'select', options: ['On-site', 'Remote', 'Hybrid'], isAdditional: true },
        { name: 'location', label: 'Location', isAdditional: true }
      ]
    },
    descLabel: 'Description'
  },
  Competition: {
    groups: {
      'Competition Details': [
        { name: 'title', label: 'Competition / Achievement Title', required: true, span: 2 },
        { name: 'program_name', label: 'Program / Event Name', span: 2 },
        { name: 'issuing_organization', label: 'Organizing Institution', span: 2 },
        { name: 'achievement_level', label: 'Level', type: 'select', options: ACHIEVEMENT_LEVELS, required: true },
        { name: 'recognition', label: 'Result / Recognition', type: 'datalist', options: ['Winner', 'Runner-up', 'First Prize', 'Second Prize', 'Third Prize', 'Finalist', 'Participant', 'Special Mention', 'Other'], required: true }
      ],
      'Date': [
        { name: 'achievement_date', label: 'Event Date', type: 'date', span: 2 }
      ]
    },
    descLabel: 'Description'
  },
  Hackathon: {
    groups: {
      'Hackathon Details': [
        { name: 'title', label: 'Hackathon Title', required: true, span: 2 },
        { name: 'issuing_organization', label: 'Organizing Institution / Organization', span: 2 },
        { name: 'achievement_level', label: 'Level', type: 'select', options: ACHIEVEMENT_LEVELS },
        { name: 'recognition', label: 'Result / Recognition', type: 'datalist', options: ['Winner', 'Runner-up', 'First Prize', 'Second Prize', 'Third Prize', 'Finalist', 'Participant', 'Special Mention', 'Other'] }
      ],
      'Date & Team': [
        { name: 'achievement_date', label: 'Event Date', type: 'date', span: 2 },
        { name: 'team_size', label: 'Team Size', type: 'number', isAdditional: true },
        { name: 'team_role', label: 'Role in Team', isAdditional: true }
      ]
    },
    descLabel: 'Description'
  },
  Workshop: {
    groups: {
      'Workshop Details': [
        { name: 'title', label: 'Workshop Name', required: true, span: 2 },
        { name: 'issuing_organization', label: 'Organizing Institution', span: 2 }
      ],
      'Date & Duration': [
        { name: 'achievement_date', label: 'Workshop Date', type: 'date' },
        { name: 'duration', label: 'Duration (e.g., 2 Days)', isAdditional: true }
      ],
      'Location': [
        { name: 'mode', label: 'Mode', type: 'select', options: ['On-site', 'Remote', 'Hybrid'], isAdditional: true },
        { name: 'location', label: 'Location', isAdditional: true }
      ]
    },
    descLabel: 'Description'
  },
  Seminar: {
    groups: {
      'Seminar Details': [
        { name: 'title', label: 'Seminar Name', required: true, span: 2 },
        { name: 'issuing_organization', label: 'Organizing Institution', span: 2 }
      ],
      'Date & Duration': [
        { name: 'achievement_date', label: 'Seminar Date', type: 'date' },
        { name: 'duration', label: 'Duration (e.g., 2 Hours)', isAdditional: true }
      ],
      'Location': [
        { name: 'mode', label: 'Mode', type: 'select', options: ['On-site', 'Remote', 'Hybrid'], isAdditional: true },
        { name: 'location', label: 'Location', isAdditional: true }
      ]
    },
    descLabel: 'Description'
  },
  Publication: {
    groups: {
      'Publication Details': [
        { name: 'title', label: 'Publication Title', required: true, span: 2 },
        { name: 'issuing_organization', label: 'Journal / Conference / Platform', span: 2 }
      ],
      'Date': [
        { name: 'achievement_date', label: 'Publication Date', type: 'date', span: 2 }
      ],
      'Additional Details': [
        { name: 'author_role', label: 'Author Role', type: 'select', options: ['First Author', 'Co-author', 'Corresponding Author', 'Other'], isAdditional: true },
        { name: 'doi_url', label: 'DOI / Publication URL', isAdditional: true }
      ]
    },
    descLabel: 'Description'
  },
  Research: {
    groups: {
      'Research Details': [
        { name: 'title', label: 'Research Title', required: true, span: 2 },
        { name: 'issuing_organization', label: 'Institution / Organization', span: 2 }
      ],
      'Duration (Optional)': [
        { name: 'start_date', label: 'Start Date', type: 'date' },
        { name: 'end_date', label: 'End Date', type: 'date' }
      ],
      'Status': [
        { name: 'research_status', label: 'Research Status', type: 'select', options: ['Ongoing', 'Completed', 'Published', 'Presented'], isAdditional: true },
        { name: 'research_role', label: 'Role', type: 'select', options: ['Researcher', 'Project Member', 'Research Intern', 'Other'], isAdditional: true }
      ]
    },
    descLabel: 'Description'
  },
  Project: {
    groups: {
      'Project Details': [
        { name: 'title', label: 'Project Title', required: true, span: 2 },
        { name: 'issuing_organization', label: 'Organization / Institution', span: 2 },
        { name: 'recognition', label: 'Outcome / Recognition', span: 2 }
      ],
      'Duration (Optional)': [
        { name: 'start_date', label: 'Start Date', type: 'date' },
        { name: 'end_date', label: 'End Date', type: 'date' }
      ],
      'Additional Details': [
        { name: 'project_role', label: 'Role', type: 'select', options: ['Developer', 'Team Lead', 'Researcher', 'Team Member', 'Other'], isAdditional: true },
        { name: 'technologies', label: 'Technologies / Tools', isAdditional: true, span: 2 }
      ]
    },
    descLabel: 'Description'
  },
  Sports: {
    groups: {
      'Sports Details': [
        { name: 'title', label: 'Sport / Achievement Title', required: true, span: 2 },
        { name: 'program_name', label: 'Event / Tournament Name', span: 2 },
        { name: 'issuing_organization', label: 'Organizing Institution', span: 2 },
        { name: 'achievement_level', label: 'Level', type: 'select', options: ACHIEVEMENT_LEVELS, required: true },
        { name: 'recognition', label: 'Position / Result', type: 'datalist', options: ['Winner', 'Runner-up', 'Gold', 'Silver', 'Bronze', 'Participant', 'Finalist', 'Other'] }
      ],
      'Date': [
        { name: 'achievement_date', label: 'Event Date', type: 'date', span: 2 }
      ]
    },
    descLabel: 'Description'
  },
  Cultural: {
    groups: {
      'Cultural Details': [
        { name: 'title', label: 'Activity / Achievement Title', required: true, span: 2 },
        { name: 'program_name', label: 'Event / Program Name', span: 2 },
        { name: 'issuing_organization', label: 'Organizing Institution', span: 2 },
        { name: 'achievement_level', label: 'Level', type: 'select', options: ACHIEVEMENT_LEVELS, required: true },
        { name: 'recognition', label: 'Position / Recognition', type: 'datalist', options: ['Winner', 'Runner-up', 'First Prize', 'Second Prize', 'Third Prize', 'Participant', 'Finalist', 'Other'] }
      ],
      'Date': [
        { name: 'achievement_date', label: 'Event Date', type: 'date', span: 2 }
      ]
    },
    descLabel: 'Description'
  },
  Leadership: {
    groups: {
      'Leadership Details': [
        { name: 'title', label: 'Role / Position', required: true, span: 2 },
        { name: 'issuing_organization', label: 'Organization / Club / Institution', span: 2 }
      ],
      'Duration': [
        { name: 'start_date', label: 'Start Date', type: 'date' },
        { name: 'end_date', label: 'End Date', type: 'date' }
      ]
    },
    descLabel: 'Responsibilities / Description'
  },
  Volunteer: {
    groups: {
      'Volunteer Details': [
        { name: 'title', label: 'Volunteer Activity / Role', required: true, span: 2 },
        { name: 'issuing_organization', label: 'Organization', span: 2 }
      ],
      'Duration': [
        { name: 'start_date', label: 'Start Date', type: 'date' },
        { name: 'end_date', label: 'End Date', type: 'date' }
      ],
      'Location': [
        { name: 'mode_location', label: 'Mode / Location', isAdditional: true, span: 2 }
      ]
    },
    descLabel: 'Responsibilities / Description'
  },
  Other: {
    groups: {
      'Achievement Details': [
        { name: 'title', label: 'Title', required: true, span: 2 },
        { name: 'program_name', label: 'Program / Event Name', span: 2 },
        { name: 'issuing_organization', label: 'Organizing Institution', span: 2 },
        { name: 'recognition', label: 'Recognition / Result', span: 2 }
      ],
      'Date': [
        { name: 'achievement_date', label: 'Achievement Date', type: 'date', span: 2 }
      ]
    },
    descLabel: 'Description'
  }
};
