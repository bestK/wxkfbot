/**
 * 客服管理API路由处理
 */
import { KFManagement } from './kf-management.js';
import { DebugLogger } from './debug-logger.js';
import { ApiResponse } from './response.js';

export function createKFRouter(env) {
    const kf = new KFManagement(env.WECHAT_CORP_ID, env.WECHAT_KF_SECRET);
    return kf;
}

function getLogger(env) {
    return new DebugLogger(env.CONVERSATIONS);
}

/**
 * 客服帐号管理路由
 */
export async function handleKFAccountList(env) {
    try {
        const kf = createKFRouter(env);
        const result = await kf.listAccounts();
        return ApiResponse.success(result, '获取客服帐号列表成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `获取客服帐号列表失败: ${error.message}`);
        return ApiResponse.internalError('获取客服帐号列表失败', { error: error.message });
    }
}

export async function handleKFAccountAdd(request, env) {
    try {
        const body = await request.json();
        if (!body.name) {
            return ApiResponse.badRequest('缺少客服名称参数 name');
        }
        const kf = createKFRouter(env);
        const result = await kf.addAccount(body.name, body.media_id);
        return ApiResponse.success(result, '添加客服帐号成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `添加客服帐号失败: ${error.message}`);
        return ApiResponse.internalError('添加客服帐号失败', { error: error.message });
    }
}

export async function handleKFAccountUpdate(request, env) {
    try {
        const body = await request.json();
        if (!body.open_kfid) {
            return ApiResponse.badRequest('缺少客服ID参数 open_kfid');
        }
        const kf = createKFRouter(env);
        const result = await kf.updateAccount(body.open_kfid, body.name, body.media_id);
        return ApiResponse.success(result, '修改客服帐号成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `修改客服帐号失败: ${error.message}`);
        return ApiResponse.internalError('修改客服帐号失败', { error: error.message });
    }
}

export async function handleKFAccountDelete(request, env) {
    try {
        const body = await request.json();
        if (!body.open_kfid) {
            return ApiResponse.badRequest('缺少客服ID参数 open_kfid');
        }
        const kf = createKFRouter(env);
        const result = await kf.deleteAccount(body.open_kfid);
        return ApiResponse.success(result, '删除客服帐号成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `删除客服帐号失败: ${error.message}`);
        return ApiResponse.internalError('删除客服帐号失败', { error: error.message });
    }
}

export async function handleKFContactWay(request, env) {
    try {
        const body = await request.json();
        if (!body.open_kfid || !body.scene) {
            return ApiResponse.badRequest('缺少参数 open_kfid 或 scene');
        }
        const kf = createKFRouter(env);
        const result = await kf.getContactWay(body.open_kfid, body.scene);
        return ApiResponse.success(result, '获取客服链接成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `获取客服链接失败: ${error.message}`);
        return ApiResponse.internalError('获取客服链接失败', { error: error.message });
    }
}

export async function handleKFServiceState(request, env) {
    try {
        const body = await request.json();
        if (!body.open_kfid || !body.external_userid) {
            return ApiResponse.badRequest('缺少参数 open_kfid 或 external_userid');
        }
        const kf = createKFRouter(env);
        const result = await kf.getServiceState(body.open_kfid, body.external_userid);
        return ApiResponse.success(result, '获取会话状态成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `获取会话状态失败: ${error.message}`);
        return ApiResponse.internalError('获取会话状态失败', { error: error.message });
    }
}

export async function handleKFServiceStateTrans(request, env) {
    try {
        const body = await request.json();
        if (!body.open_kfid || !body.external_userid || body.service_state === undefined) {
            return ApiResponse.badRequest('缺少参数');
        }
        const kf = createKFRouter(env);
        const result = await kf.transServiceState(body.open_kfid, body.external_userid, body.service_state, body.servicer_userid);
        return ApiResponse.success(result, '转接会话成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `转接会话失败: ${error.message}`);
        return ApiResponse.internalError('转接会话失败', { error: error.message });
    }
}

export async function handleKFSendMessage(request, env) {
    let body;
    try {
        body = await request.json();
        if (!body.touser || !body.open_kfid || !body.msgtype) {
            return ApiResponse.badRequest('缺少参数 touser, open_kfid 或 msgtype');
        }
        const kf = createKFRouter(env);
        const result = await kf.request('POST', '/kf/send_msg', body);
        // 保存已发消息到 KV，供前端立即显示
        try {
            const key = `__SENT_MSG__${body.open_kfid}__${body.touser}`;
            const existing = await env.CONVERSATIONS.get(key, 'json') || [];
            const { touser, open_kfid, msgtype, ...content } = body;
            existing.push({
                msgid: result?.msgid || `sent_${Date.now()}`,
                open_kfid,
                external_userid: touser,
                send_time: Math.floor(Date.now() / 1000),
                origin: 5,
                msgtype,
                ...content,
            });
            await env.CONVERSATIONS.put(key, JSON.stringify(existing.slice(-200)));
        } catch (_) {}
        return ApiResponse.success(result, '发送消息成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `发送消息失败: ${error.message}`, {
            touser: body?.touser,
            open_kfid: body?.open_kfid,
            msgtype: body?.msgtype,
        });
        return ApiResponse.internalError('发送消息失败', { error: error.message });
    }
}

export async function handleKFSyncMsg(request, env) {
    try {
        const body = await request.json();
        const kf = createKFRouter(env);
        const result = await kf.syncMessages(body.cursor, body.token, body.limit, body.voice_format, body.open_kfid);
        return ApiResponse.success(result, '同步消息成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `同步消息失败: ${error.message}`);
        return ApiResponse.internalError('同步消息失败', { error: error.message });
    }
}

export async function handleKFSentMessages(request, env) {
    if (!env.CONVERSATIONS) {
        return ApiResponse.internalError('KV 未配置');
    }
    try {
        const body = await request.json();
        const { open_kfid, external_userid } = body;
        if (!open_kfid || !external_userid) {
            return ApiResponse.badRequest('缺少参数 open_kfid 或 external_userid');
        }
        const key = `__SENT_MSG__${open_kfid}__${external_userid}`;
        const raw = await env.CONVERSATIONS.get(key, 'json');
        return ApiResponse.success({ msg_list: raw || [] });
    } catch (error) {
        return ApiResponse.internalError('获取已发消息失败', { error: error.message });
    }
}

export async function handleKFCustomerInfo(request, env) {
    try {
        const body = await request.json();
        if (!body.external_userid_list || !Array.isArray(body.external_userid_list)) {
            return ApiResponse.badRequest('缺少参数 external_userid_list');
        }
        const kf = createKFRouter(env);
        const result = await kf.batchGetCustomers(body.external_userid_list, body.need_enter_scene_info);
        return ApiResponse.success(result, '获取客户信息成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `获取客户信息失败: ${error.message}`);
        return ApiResponse.internalError('获取客户信息失败', { error: error.message });
    }
}

export async function handleKFStatistics(request, env) {
    try {
        const body = await request.json();
        if (!body.open_kfid || !body.start_time || !body.end_time) {
            return ApiResponse.badRequest('缺少参数 open_kfid, start_time 或 end_time');
        }
        const kf = createKFRouter(env);
        const result = await kf.getStatistics(body.open_kfid, body.start_time, body.end_time);
        return ApiResponse.success(result, '获取统计数据成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `获取统计数据失败: ${error.message}`);
        return ApiResponse.internalError('获取统计数据失败', { error: error.message });
    }
}

export async function handleKFRecallMsg(request, env) {
    try {
        const body = await request.json();
        if (!body.msgid) {
            return ApiResponse.badRequest('缺少参数 msgid');
        }
        const kf = createKFRouter(env);
        const result = await kf.recallMessage(body.msgid, body.open_kfid);
        return ApiResponse.success(result, '撤回消息成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `撤回消息失败: ${error.message}`);
        return ApiResponse.internalError('撤回消息失败', { error: error.message });
    }
}

export async function handleKFMediaProxy(request, env) {
    try {
        const url = new URL(request.url);
        const mediaId = url.searchParams.get('media_id');
        if (!mediaId) {
            return ApiResponse.badRequest('缺少参数 media_id');
        }
        const kf = createKFRouter(env);
        const mediaUrl = await kf.getMediaUrl(mediaId);
        const resp = await fetch(mediaUrl);
        if (!resp.ok) {
            return ApiResponse.internalError('获取媒体文件失败');
        }
        return new Response(resp.body, {
            headers: {
                'Content-Type': resp.headers.get('Content-Type') || 'application/octet-stream',
                'Content-Disposition': resp.headers.get('Content-Disposition') || '',
                'Cache-Control': 'public, max-age=86400',
            },
        });
    } catch (error) {
        await getLogger(env).error('wechat-api', `获取媒体文件失败: ${error.message}`);
        return ApiResponse.internalError('获取媒体文件失败', { error: error.message });
    }
}

export async function handleKFSendWelcomeMsg(request, env) {
    try {
        const body = await request.json();
        if (!body.code) {
            return ApiResponse.badRequest('缺少参数 code');
        }
        const kf = createKFRouter(env);
        const result = await kf.sendWelcomeMsg(body.code, body.msgtype, body);
        return ApiResponse.success(result, '欢迎语发送成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `欢迎语发送失败: ${error.message}`);
        return ApiResponse.internalError('欢迎语发送失败', { error: error.message });
    }
}

// ==================== 客服固定回复 ====================
// 存储说明：
//   __FIXED_REPLIES__            —— JSON map，key 为 open_kfid，保存开关/类型/文字/图片元数据
//   __FIXED_REPLY_IMG__{kfid}    —— 图片原始字节（ArrayBuffer），content_type 存在 metadata
// 图片按需重新上传换取临时 media_id（企业微信临时素材仅 3 天有效），缓存在配置里复用。

const FIXED_REPLIES_KEY = '__FIXED_REPLIES__';
const FIXED_REPLY_IMG_PREFIX = '__FIXED_REPLY_IMG__';

async function readFixedReplies(env) {
    const raw = await env.CONVERSATIONS.get(FIXED_REPLIES_KEY);
    return raw ? JSON.parse(raw) : {};
}

async function writeFixedReplies(env, map) {
    await env.CONVERSATIONS.put(FIXED_REPLIES_KEY, JSON.stringify(map));
}

/**
 * 获取全部固定回复配置（不含图片字节，附带 has_image 标记）
 * GET /kf/fixed_replies
 */
export async function handleKFFixedReplyList(env) {
    try {
        const map = await readFixedReplies(env);
        const result = {};
        for (const [kfid, cfg] of Object.entries(map)) {
            result[kfid] = {
                enabled: !!cfg.enabled,
                type: cfg.type || 'text',
                text: cfg.text || '',
                has_image: !!(cfg.image && cfg.image.filename),
                image_filename: cfg.image?.filename || '',
            };
        }
        return ApiResponse.success({ replies: result }, '获取固定回复配置成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `获取固定回复配置失败: ${error.message}`);
        return ApiResponse.internalError('获取固定回复配置失败', { error: error.message });
    }
}

/**
 * 设置固定回复的开关/类型/文字
 * POST /kf/fixed_reply  { open_kfid, enabled, type, text }
 */
export async function handleKFFixedReplySet(request, env) {
    try {
        const body = await request.json();
        if (!body.open_kfid) {
            return ApiResponse.badRequest('缺少客服ID参数 open_kfid');
        }
        const type = body.type === 'image' ? 'image' : 'text';
        if (type === 'text' && body.enabled && !String(body.text || '').trim()) {
            return ApiResponse.badRequest('文字固定回复内容不能为空');
        }
        const map = await readFixedReplies(env);
        const prev = map[body.open_kfid] || {};
        map[body.open_kfid] = {
            ...prev,
            enabled: !!body.enabled,
            type,
            text: body.text != null ? String(body.text) : (prev.text || ''),
            image: prev.image || null,
        };
        if (type === 'image' && body.enabled && !map[body.open_kfid].image?.filename) {
            return ApiResponse.badRequest('图片固定回复需要先上传图片');
        }
        await writeFixedReplies(env, map);
        return ApiResponse.success(null, '固定回复配置已更新');
    } catch (error) {
        await getLogger(env).error('wechat-api', `更新固定回复配置失败: ${error.message}`);
        return ApiResponse.internalError('更新固定回复配置失败', { error: error.message });
    }
}

/**
 * 上传固定回复图片（原始字节持久化到 KV）
 * POST /kf/fixed_reply/image  multipart: open_kfid, file
 */
export async function handleKFFixedReplyImage(request, env) {
    try {
        const form = await request.formData();
        const openKfid = form.get('open_kfid');
        const file = form.get('file');
        if (!openKfid) {
            return ApiResponse.badRequest('缺少客服ID参数 open_kfid');
        }
        if (!file || !(file instanceof File) || file.size === 0) {
            return ApiResponse.badRequest('图片文件为空或未提供');
        }
        const buffer = await file.arrayBuffer();
        const contentType = file.type || 'image/png';
        const filename = file.name || 'image.png';
        await env.CONVERSATIONS.put(`${FIXED_REPLY_IMG_PREFIX}${openKfid}`, buffer, {
            metadata: { content_type: contentType, filename },
        });
        const map = await readFixedReplies(env);
        const prev = map[openKfid] || {};
        map[openKfid] = {
            ...prev,
            type: 'image',
            // 更换图片后清空缓存的 media_id，强制下次发送时重新上传
            image: { filename, content_type: contentType, media_id: '', media_uploaded_at: 0 },
        };
        await writeFixedReplies(env, map);
        return ApiResponse.success({ filename }, '固定回复图片已上传');
    } catch (error) {
        await getLogger(env).error('wechat-api', `上传固定回复图片失败: ${error.message}`);
        return ApiResponse.internalError('上传固定回复图片失败', { error: error.message });
    }
}

/**
 * 回显固定回复图片给前端预览
 * GET /kf/fixed_reply/image?open_kfid=
 */
export async function handleKFFixedReplyImageGet(request, env) {
    try {
        const url = new URL(request.url);
        const openKfid = url.searchParams.get('open_kfid');
        if (!openKfid) {
            return ApiResponse.badRequest('缺少参数 open_kfid');
        }
        const { value, metadata } = await env.CONVERSATIONS.getWithMetadata(
            `${FIXED_REPLY_IMG_PREFIX}${openKfid}`,
            { type: 'arrayBuffer' },
        );
        if (!value) {
            return ApiResponse.notFound('未找到固定回复图片');
        }
        return new Response(value, {
            headers: {
                'Content-Type': metadata?.content_type || 'application/octet-stream',
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        await getLogger(env).error('wechat-api', `获取固定回复图片失败: ${error.message}`);
        return ApiResponse.internalError('获取固定回复图片失败', { error: error.message });
    }
}

/**
 * 删除某客服的固定回复配置
 * POST /kf/fixed_reply/delete  { open_kfid }
 */
export async function handleKFFixedReplyDelete(request, env) {
    try {
        const body = await request.json();
        if (!body.open_kfid) {
            return ApiResponse.badRequest('缺少客服ID参数 open_kfid');
        }
        const map = await readFixedReplies(env);
        delete map[body.open_kfid];
        await writeFixedReplies(env, map);
        await env.CONVERSATIONS.delete(`${FIXED_REPLY_IMG_PREFIX}${body.open_kfid}`);
        return ApiResponse.success(null, '固定回复配置已删除');
    } catch (error) {
        await getLogger(env).error('wechat-api', `删除固定回复配置失败: ${error.message}`);
        return ApiResponse.internalError('删除固定回复配置失败', { error: error.message });
    }
}
