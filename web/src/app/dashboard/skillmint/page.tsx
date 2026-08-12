"use client"

import { Icon } from "@/components/icons"

export default function SkillMintPage() {
  return (
    <div className="panel panel-pad" style={{ marginTop: '24px' }}>
      <div className="panel-heading">
        <div>
          <h2>SkillMint Integration</h2>
          <p>Mint skills, manage your verified identity, and interact with the Skill Registry.</p>
        </div>
        <span className="icon-box"><Icon name="spark" /></span>
      </div>
      
      <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ color: 'var(--text-muted)' }}>
          This section is the placeholder for the SkillMint integration as requested. You can drop your SkillMint dashboard components here.
        </p>
        <button className="button button-primary" style={{ width: 'fit-content' }}>
          <Icon name="spark" size={16} /> Launch SkillMint Agent
        </button>
      </div>
    </div>
  )
}
