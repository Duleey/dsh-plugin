// dsh-deepseek-quota — browser half.
//
// A floating card pinned to the bottom-right corner of the dsh web GUI
// (registered into the frame-wide `shell.overlay` slot — additive, above
// every column, click-through until the card opts back into pointer events).
// It polls the host route `/api/deepseek-balance` (see lib/index.js) every
// minute and shows the remaining DeepSeek API balance plus today's
// consumption, with a manual refresh button and explicit error states.
// Styling uses only `--dsw-*` theme tokens that exist in the shipped theme
// build, so it follows light/dark mode.
window.__ModuleLoader__.load({
	id: "dsh-deepseek-quota-left",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let jsxRuntime = require("react/jsx-runtime");
		const { useState, useEffect, useCallback, useRef } = react;
		const { jsx, jsxs, Fragment } = jsxRuntime;

		// ---- constants -------------------------------------------------
		const POLL_MS = 60 * 1000;
		const BALANCE_PATH = "/api/deepseek-balance";

		// ---- small helpers ---------------------------------------------
		function currencySymbol(code) {
			switch (code) {
				case "CNY": return "¥";
				case "USD": return "$";
				case "EUR": return "€";
				case "JPY": return "¥";
				case "HKD": return "HK$";
				default: return code ? `${code} ` : "";
			}
		}

		function formatBalance(value, currency) {
			const symbol = currencySymbol(currency);
			return `${symbol}${String(value)}`;
		}

		// 费用展示：按量级选择小数位，避免 ¥0.000000… 长尾（参考 dsh-web-billing）。
		function formatCost(value, currency) {
			const symbol = currencySymbol(currency);
			if (!Number.isFinite(value) || value <= 0) return `${symbol}0`;
			if (value >= 100) return `${symbol}${value.toFixed(0)}`;
			if (value >= 1) return `${symbol}${value.toFixed(2)}`;
			if (value >= 0.01) return `${symbol}${value.toFixed(3)}`;
			return `${symbol}${value.toPrecision(2)}`;
		}

		// 千分位格式化 token 数。
		function formatTokens(value) {
			return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		}

		// 单价展示（¥/M，CNY 计价）。
		function formatRate(rate) {
			const n = rate >= 1 ? rate.toFixed(2) : rate.toFixed(3);
			return `¥${n}/M`;
		}

		function formatTime(date) {
			const hh = String(date.getHours()).padStart(2, "0");
			const mm = String(date.getMinutes()).padStart(2, "0");
			const ss = String(date.getSeconds()).padStart(2, "0");
			return `${hh}:${mm}:${ss}`;
		}

		async function fetchBalance() {
			const res = await fetch(BALANCE_PATH, { cache: "no-store" });
			let body = null;
			try {
				body = await res.json();
			} catch {}
			if (!res.ok) {
				const message =
					body && typeof body.message === "string"
						? body.message
						: `请求失败（HTTP ${res.status}）`;
				const error = new Error(message);
				error.code = body && typeof body.error === "string" ? body.error : `http-${res.status}`;
				throw error;
			}
			// New host shape: { ok, balance, todayConsumed, todayConsumedSource }.
			// Older host: the raw provider payload verbatim. Accept both.
			const payload = body && typeof body === "object" && body.balance ? body.balance : body;
			const todayConsumed =
				body && typeof body === "object" && typeof body.todayConsumed === "number"
					? body.todayConsumed
					: null;
			const todayConsumedSource =
				body && typeof body === "object" && typeof body.todayConsumedSource === "string"
					? body.todayConsumedSource
					: void 0;
			return { payload, todayConsumed, todayConsumedSource };
		}

		// ---- inline styles ---------------------------------------------
		// 外层容器：贴左边缘，垂直位置偏上一些。把手 + 卡片并排（flex），卡片默认折叠。
		const wrapper = {
			position: "absolute",
			left: 0,
			bottom: 120,
			zIndex: 30,
			pointerEvents: "auto",
			display: "flex",
			flexDirection: "row",
			alignItems: "flex-end",
			gap: 8
		};

		// 左侧折叠把手：竖排文字，点击展开/收起卡片。
		const handle = {
			flex: "none",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			writingMode: "vertical-rl",
			width: 26,
			padding: "12px 0",
			borderRadius: "0 10px 10px 0",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderLeft: "none",
			background: "var(--dsw-alias-bg-overlay)",
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 12,
			fontWeight: 600,
			letterSpacing: 1,
			cursor: "pointer",
			userSelect: "none",
			transition: "color 0.15s ease"
		};

		const card = {
			boxSizing: "border-box",
			width: 240,
			borderRadius: 12,
			border: "1px solid var(--dsw-alias-border-l2)",
			background: "var(--dsw-alias-bg-overlay)",
			boxShadow: "0 4px 16px rgba(0, 0, 0, 0.16)",
			color: "var(--dsw-alias-label-primary)",
			fontSize: 12,
			lineHeight: "18px",
			padding: "8px 10px",
			display: "flex",
			flexDirection: "column",
			gap: 2
		};

		const headerRow = {
			display: "flex",
			alignItems: "center",
			gap: 6,
			height: 20
		};

		const title = {
			flex: 1,
			minWidth: 0,
			display: "flex",
			alignItems: "center",
			gap: 6,
			fontWeight: 600,
			whiteSpace: "nowrap",
			overflow: "hidden",
			textOverflow: "ellipsis"
		};

		const refreshButton = {
			flex: "none",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			width: 20,
			height: 20,
			border: 0,
			borderRadius: 6,
			padding: 0,
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			cursor: "pointer"
		};

		const balanceRow = {
			display: "flex",
			alignItems: "baseline",
			gap: 6
		};

		const balanceValue = {
			fontSize: 20,
			lineHeight: "26px",
			fontWeight: 700,
			fontVariantNumeric: "tabular-nums",
			whiteSpace: "nowrap"
		};

		const statusChip = {
			flex: "none",
			borderRadius: 999,
			padding: "0 6px",
			fontSize: 10,
			lineHeight: "16px"
		};

		const consumedRow = {
			display: "flex",
			alignItems: "center",
			gap: 4,
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 11,
			lineHeight: "16px",
			fontVariantNumeric: "tabular-nums",
			whiteSpace: "nowrap"
		};

		const convCostRow = {
			display: "flex",
			alignItems: "center",
			gap: 4,
			color: "var(--dsw-alias-label-primary)",
			fontSize: 12,
			lineHeight: "18px",
			fontWeight: 600,
			fontVariantNumeric: "tabular-nums",
			whiteSpace: "nowrap"
		};

		const convCostLabel = {
			color: "var(--dsw-alias-label-secondary)",
			fontWeight: 400
		};

		const infoIcon = {
			flex: "none",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			width: 14,
			height: 14,
			borderRadius: "50%",
			color: "var(--dsw-alias-label-secondary)",
			cursor: "help",
			verticalAlign: "middle"
		};

		const tipBox = {
			position: "absolute",
			bottom: "calc(100% + 8px)",
			left: 0,
			zIndex: 40,
			boxSizing: "border-box",
			width: 310,
			borderRadius: 10,
			border: "1px solid var(--dsw-alias-border-l2)",
			background: "var(--dsw-alias-bg-overlay)",
			boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
			padding: "8px 10px",
			fontSize: 11,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-primary)",
			display: "flex",
			flexDirection: "column",
			gap: 2
		};

		const tipTitle = {
			fontWeight: 600,
			fontSize: 12,
			lineHeight: "18px",
			marginBottom: 2,
			fontVariantNumeric: "tabular-nums"
		};

		const tipRow = {
			display: "flex",
			alignItems: "baseline",
			justifyContent: "space-between",
			gap: 8,
			fontVariantNumeric: "tabular-nums"
		};

		const tipLabel = {
			color: "var(--dsw-alias-label-secondary)",
			flex: "none",
			whiteSpace: "nowrap"
		};

		const tipFormula = {
			color: "var(--dsw-alias-label-primary)",
			textAlign: "right",
			whiteSpace: "nowrap",
			overflow: "hidden",
			textOverflow: "ellipsis"
		};

		const tipFooter = {
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 10,
			lineHeight: "16px",
			marginTop: 2,
			borderTop: "1px solid var(--dsw-alias-border-l1)",
			paddingTop: 4,
			fontVariantNumeric: "tabular-nums"
		};

		const metaRow = {
			display: "flex",
			alignItems: "center",
			gap: 8,
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 11,
			lineHeight: "16px",
			whiteSpace: "nowrap",
			overflow: "hidden"
		};

		const metaItem = {
			display: "flex",
			alignItems: "center",
			gap: 4,
			fontVariantNumeric: "tabular-nums",
			minWidth: 0,
			overflow: "hidden",
			textOverflow: "ellipsis"
		};

		const updatedRow = {
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 10,
			lineHeight: "14px",
			display: "flex",
			alignItems: "center",
			gap: 4,
			fontVariantNumeric: "tabular-nums"
		};

		const errorText = {
			color: "var(--dsw-alias-state-error-primary)",
			fontSize: 11,
			lineHeight: "16px",
			wordBreak: "break-all"
		};

		const loadingText = {
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 12,
			lineHeight: "18px"
		};

		// ---- the widget -------------------------------------------------
		function DeepSeekQuotaBadge(props) {
			const useSessions = props.useSessions;
			const [data, setData] = useState(null);
			const [phase, setPhase] = useState("loading"); // loading | ready | error
			const [message, setMessage] = useState("");
			const [updatedAt, setUpdatedAt] = useState(null);
			const [spinning, setSpinning] = useState(false);
			const [conversation, setConversation] = useState(null); // 会话费用接口的完整返回（含 breakdown）
			const [tipOpen, setTipOpen] = useState(false);
			const [collapsed, setCollapsed] = useState(true);
			const mounted = useRef(true);

			// 当前会话 id（SessionListState.current，由框架标准属性注入）。
			const currentSessionId = typeof useSessions === "function" ? useSessions((s) => s.current) : void 0;

			// 轮询当前对话费用（宿主按会话日志回放计价，5s 一次，本地路由开销可忽略）。
			useEffect(() => {
				if (currentSessionId === void 0) {
					setConversation(null);
					return;
				}
				let cancelled = false;
				const loadCost = async () => {
					try {
						const res = await fetch(`/api/deepseek-session-cost?sessionId=${encodeURIComponent(currentSessionId)}`, { cache: "no-store" });
						const body = await res.json();
						if (cancelled || body === null || typeof body !== "object" || body.ok !== true) return;
						setConversation(body);
					} catch {}
				};
				loadCost();
				const timer = setInterval(loadCost, 5000);
				return () => {
					cancelled = true;
					clearInterval(timer);
				};
			}, [currentSessionId]);

			const load = useCallback(async () => {
				setSpinning(true);
				try {
					const result = await fetchBalance();
					if (!mounted.current) return;
					setData(result);
					setPhase("ready");
					setMessage("");
					setUpdatedAt(new Date());
				} catch (error) {
					if (!mounted.current) return;
					setPhase("error");
					setMessage(error instanceof Error ? error.message : String(error));
				} finally {
					if (mounted.current) setSpinning(false);
				}
			}, []);

			useEffect(() => {
				mounted.current = true;
				load();
				const timer = setInterval(load, POLL_MS);
				return () => {
					mounted.current = false;
					clearInterval(timer);
				};
			}, [load]);

			const payload = data ? data.payload : null;
			const balance = payload && Array.isArray(payload.balance_infos) ? payload.balance_infos[0] : null;
			const available = payload ? payload.is_available !== false : null;
			const currency = balance ? balance.currency : "CNY";
			const todayConsumed = data ? data.todayConsumed : null;

			const conversationCost = conversation && typeof conversation.cost === "number" ? conversation.cost : null;
			const breakdown = conversation && Array.isArray(conversation.breakdown) ? conversation.breakdown : null;
			const formulaLines = breakdown ? breakdown.filter((b) => b !== null && typeof b === "object" && b.tokens > 0) : [];

			const stateColor =
				phase === "error"
					? "var(--dsw-alias-state-error-primary)"
					: available === false
						? "var(--dsw-alias-state-error-primary)"
						: "var(--dsw-alias-state-success-primary)";

			let chip = null;
			if (phase === "ready") {
				chip = jsx("span", {
					style: {
						...statusChip,
						color: stateColor,
						background: "var(--dsw-alias-interactive-bg-hover)"
					},
					children: available === false ? "不可用" : "可用"
				});
			} else if (phase === "error") {
				chip = jsx("span", {
					style: { ...statusChip, color: stateColor },
					children: "错误"
				});
			}

			const dot = jsx("span", {
				style: {
					flex: "none",
					width: 8,
					height: 8,
					borderRadius: "50%",
					background: phase === "loading" ? "var(--dsw-alias-label-secondary)" : stateColor
				},
				"aria-hidden": true
			});

			const refreshIcon = jsx("svg", {
				width: 13,
				height: 13,
				viewBox: "0 0 16 16",
				fill: "none",
				style: spinning ? { animation: "dsh-quota-spin 0.8s linear infinite" } : void 0,
				children: jsx("path", {
					d: "M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 1.5v3h-3",
					stroke: "currentColor",
					strokeWidth: 1.5,
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});

			return jsxs("div", {
				style: wrapper,
				children: [
					jsx("button", {
						type: "button",
						style: handle,
						"aria-label": collapsed ? "展开额度面板" : "收起额度面板",
						title: collapsed ? "展开额度面板" : "收起额度面板",
						"aria-expanded": !collapsed,
						onClick: () => setCollapsed((c) => !c),
						children: "额度"
					}),
					collapsed
						? null
						: jsx("div", {
							role: "status",
							"aria-live": "polite",
							"data-plugin": "dsh-deepseek-quota",
							title: "DeepSeek API 额度",
							style: card,
							children: jsxs(Fragment, {
								children: [
									jsxs("div", {
										style: headerRow,
										children: [
											dot,
											jsx("span", { style: title, children: "DeepSeek 额度" }),
											jsx("button", {
												type: "button",
												style: refreshButton,
												"aria-label": "刷新额度",
												title: "刷新",
												disabled: spinning,
												onClick: () => { load(); },
												children: refreshIcon
											})
										]
									}),
									phase === "loading"
										? jsx("div", { style: loadingText, children: "加载中…" })
										: phase === "error"
											? jsx("div", {
												style: errorText,
												title: message,
												children: message
											})
											: jsxs(Fragment, {
												children: [
													jsxs("div", {
														style: balanceRow,
														children: [
															jsx("span", { style: balanceValue, children: balance ? formatBalance(balance.total_balance, currency) : "—" }),
															chip
														]
													}),
													currentSessionId !== void 0 && conversationCost !== null
														? jsxs("div", {
															style: convCostRow,
															children: [
																jsx("span", { style: convCostLabel, children: "当前对话费用" }),
																jsx("span", { children: formatCost(conversationCost, currency) }),
																jsx("span", {
																	role: "button",
																	tabIndex: 0,
																	"aria-label": "查看当前对话费用计算公式",
																	title: "查看计算公式",
																	style: infoIcon,
																	onMouseEnter: () => { setTipOpen(true); },
																	onMouseLeave: () => { setTipOpen(false); },
																	onFocus: () => { setTipOpen(true); },
																	onBlur: () => { setTipOpen(false); },
																	children: jsx("svg", {
																		width: 13,
																		height: 13,
																		viewBox: "0 0 16 16",
																		fill: "none",
																		children: jsxs(Fragment, {
																			children: [
																				jsx("circle", { cx: 8, cy: 8, r: 6.5, stroke: "currentColor", strokeWidth: 1.3 }),
																				jsx("path", { d: "M8 5v3.6", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" }),
																				jsx("circle", { cx: 8, cy: 11.2, r: 0.9, fill: "currentColor" })
																			]
																		})
																	})
																})
															]
														})
														: null,
													tipOpen && currentSessionId !== void 0 && conversationCost !== null && formulaLines.length > 0
														? jsx("div", {
															role: "tooltip",
															style: tipBox,
															children: jsxs(Fragment, {
																children: [
																	jsx("div", { style: tipTitle, children: `当前对话费用 = ${formatCost(conversationCost, currency)}` }),
																	...formulaLines.map((b) => jsxs("div", {
																		style: tipRow,
																		children: [
																			jsx("span", { style: tipLabel, children: b.label }),
																			jsx("span", {
																				style: tipFormula,
																				children: `${formatTokens(b.tokens)} tok × ${formatRate(b.rate)} = ${formatCost(b.subtotal, currency)}`
																			})
																		]
																	}, b.label)),
																	jsx("div", {
																		style: tipFooter,
																		children: `合计 ${formatCost(conversationCost, currency)} · 按消息时刻官方价格表计价（含峰谷）`
																	})
																]
															})
														})
														: null,
													todayConsumed !== null
														? jsx("div", {
															style: consumedRow,
															children: `今日${data.todayConsumedSource === "official" ? "已消费" : "约消费"} ${formatBalance(todayConsumed, currency)}`
														})
														: null,
													jsxs("div", {
														style: metaRow,
														children: [
															jsx("span", { style: metaItem, children: `赠送 ${balance ? formatBalance(balance.granted_balance, currency) : "—"}` }),
															jsx("span", { children: "·" }),
															jsx("span", { style: metaItem, children: `充值 ${balance ? formatBalance(balance.topped_up_balance, currency) : "—"}` })
														]
													}),
													updatedAt
														? jsx("div", { style: updatedRow, children: `更新于 ${formatTime(updatedAt)}` })
														: null
												]
											})
								]
							})
						})
				]
			});
		}

		// ---- client plugin body -----------------------------------------
		const inject = ["slots"];

		function apply(ctx) {
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "deepseek-quota",
				order: 100,
				label: "DeepSeek 额度"
			}, DeepSeekQuotaBadge));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
