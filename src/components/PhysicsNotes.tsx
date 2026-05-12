export function PhysicsNotes() {
  return (
    <details className="physics-notes">
      <summary>物理说明</summary>
      <div className="notes-body">
        <p>
          点电荷电场使用 E(r) = Σ k qᵢ (r − rᵢ) / |r − rᵢ|³，多个源电荷的电场按矢量叠加。
        </p>
        <p>
          测试电荷受力 F = qE，加速度 a = F / m。正测试电荷受力方向与电场方向相同，负测试电荷受力方向与电场方向相反。
        </p>
        <p>
          真实点电荷模型在 r → 0 时会发散，所以本程序用 r_min 限制最小作用距离，避免 Infinity、NaN 和数值爆炸。
        </p>
        <p>
          热力图颜色只表示电场强度大小 |E|，不表示电势正负；方向由箭头和场线表示。
        </p>
        <p>
          simulationK 保留库仑定律结构，但比真实库仑常数小，用于课堂可视化稳定。速度和加速度上限也是数值稳定保护，不是基本物理定律。
        </p>
      </div>
    </details>
  )
}
